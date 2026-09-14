import { json } from '@sveltejs/kit';
import Stripe from 'stripe';
import { prisma } from '$lib/server/index';
import dotenv from 'dotenv';
import { getUserIdByOrderId } from '$lib/prisma/order/prendingOrder';
import { nextInvoiceNumber } from '$lib/server/invoice/number';
import { snapshotInvoiceTotals } from '$lib/server/invoice/totals';
import { withLock } from '$lib/server/lock';
import { enqueuePostPaymentJob, enqueueInvoiceEmailJob } from '$lib/server/qstash';
import { deduceWeightBracket, fallbackShippingMethod } from '$lib/server/jobs/post-payment';
import { log } from '$lib/server/log';

/**
 * Webhook Stripe.
 *
 * COMMERCE-PLUGIN : crée la `Transaction` et passe la commande en `PAID`.
 * Facture (SMTP) et SENDCLOUD (commande + étiquette) partent chacun dans leur
 * propre job asynchrone après la transaction (`$lib/server/qstash.ts` →
 * `$lib/server/jobs/invoice-email.ts` / `jobs/post-payment.ts`), pour ne
 * jamais faire traîner la réponse à Stripe derrière un appel externe lent, et
 * pour qu'un ralentissement de l'un n'affecte pas l'autre.
 * Le store panier client n'est pas réinitialisé ici (no-op hors navigateur) :
 * `/checkout/success` s'en charge.
 */

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export async function POST({ request }: { request: Request }) {
	const sig = request.headers.get('stripe-signature');
	const body = await request.text(); // Récupère le corps brut

	let event: Stripe.Event;

	try {
		event = stripe.webhooks.constructEvent(
			body,
			sig || '',
			process.env.STRIPE_WEBHOOK_SECRET || ''
		);
	} catch (err: any) {
		log('ERROR', 'webhook:stripe', '⚠️ Webhook signature verification failed.', err.message);
		return json({ error: 'Webhook signature verification failed.' }, { status: 400 });
	}

	// Handle the event
	switch (event.type) {
		case 'checkout.session.completed': {
			const session = event.data.object as Stripe.Checkout.Session;
			// Verrou distribué : Stripe peut livrer le même webhook deux fois en
			// parallèle, ce qui laisserait passer les deux appels au travers du
			// `findUnique` de `handleCheckoutSession` avant que l'un des deux
			// n'ait eu le temps d'écrire la transaction.
			await withLock(`stripe:checkout:${session.id}`, 30, () => handleCheckoutSession(session));
			break;
		}

		case 'payment_intent.succeeded':
		case 'charge.succeeded':
			break;

		default:
			log('WARN', 'webhook:stripe', `⚠️ Unhandled event type: ${event.type}`);
	}
	return json({ received: true }, { status: 200 });
}

/**
 * Gère la fin d'une session de paiement
 * 1) On enregistre la transaction en base (dans une transaction courte)
 * 2) On appelle Sendcloud hors transaction
 */
async function handleCheckoutSession(session: Stripe.Checkout.Session) {
	log('DEBUG', 'webhook:stripe', '=== DÉBUT TRAITEMENT WEBHOOK CHECKOUT ===');
	// Pas de `customer_details` (nom/email/téléphone/adresse) dans les logs :
	// ils partent vers un système tiers (Vercel) qui n'a pas à recevoir de PII.
	log('DEBUG', 'webhook:stripe', 'Session Stripe reçue:', {
		id: session.id,
		amount_total: session.amount_total,
		currency: session.currency,
		payment_status: session.payment_status,
		metadata: session.metadata
	});

	const orderId = session.metadata?.order_id;
	if (!orderId) {
		log('ERROR', 'webhook:stripe', '❌ Order ID manquant dans les métadonnées de la session');
		return;
	}

	const user = await getUserIdByOrderId(orderId);
	if (!user || !user.userId) {
		log('ERROR', 'webhook:stripe', '❌ Utilisateur introuvable pour la commande:', orderId);
		return;
	}

	const userId = user.userId;

	const already = await prisma.transaction.findUnique({
		where: { stripePaymentId: session.id }
	});
	if (already) {
		log('DEBUG', 'webhook:stripe', 'ℹ️ Transaction déjà enregistrée:', already.id);
		return already;
	}

	let createdTransaction;

	try {
		// (1) ENREGISTREMENT EN DB via une transaction Prisma courte — aucun
		// appel Sendcloud ici : un timeout réseau empêcherait la facture d'exister.
		createdTransaction = await prisma.$transaction(async (prismaTx) => {
			// Récupère la commande
			const order = await prismaTx.order.findUnique({
				where: { id: orderId },
				include: {
					user: true,
					address: true,
					items: { include: { product: true, custom: true } }
				}
			});

			if (!order) {
				throw new Error(`⚠️ Order ${orderId} not found`);
			}
			if (!order.address) {
				throw new Error(`⚠️ Order ${orderId} has no associated address`);
			}

			const weightBracket = deduceWeightBracket(order);
			// Dimensions de secours uniquement : aucun fetch Sendcloud ici.
			const shippingMethodData = fallbackShippingMethod(order.shippingOption || '', weightBracket);

			const invoiceNumber = await nextInvoiceNumber(prismaTx);
			const invoiceTotals = snapshotInvoiceTotals({
				lines: order.items.map((item: { price: number; quantity: number }) => ({
					price: item.price,
					quantity: item.quantity
				})),
				shippingCost: parseFloat(order.shippingCost?.toString() ?? '0'),
				discountAmount: order.discountAmount ?? 0,
				paidTotal: (session.amount_total ?? 0) / 100
			});

			// Préparation des données de la transaction
			const transactionData = {
				// Liens Stripe
				stripePaymentId: session.id,
				amount: (session.amount_total ?? 0) / 100,
				currency: session.currency ?? 'eur',
				customer_details_email: session.customer_details?.email || '',
				customer_details_name: session.customer_details?.name || '',
				customer_details_phone: session.customer_details?.phone || '',
				status: session.payment_status || 'unknown',
				orderId: orderId,
				createdAt: session.created ? new Date(session.created * 1000) : new Date(),

				// Infos transport
				shippingOption: order.shippingOption ?? '',
				shippingCost: parseFloat(order.shippingCost?.toString() ?? '0'),

				// Méthode d'expédition
				shippingMethodId: shippingMethodData?.id ?? 9999, // ID par défaut si null
				shippingMethodName: shippingMethodData?.name ?? `Méthode: ${order.shippingOption}`,

				// Dimensions + Poids
				package_length: shippingMethodData?.length ?? 50, // Valeur par défaut si null
				package_width: shippingMethodData?.width ?? 40, // Valeur par défaut si null
				package_height: shippingMethodData?.height ?? 30, // Valeur par défaut si null
				package_dimension_unit: shippingMethodData?.unit ?? 'cm',
				package_weight: shippingMethodData?.weight ?? weightBracket, // Utilise le bracket de poids si null
				package_weight_unit: shippingMethodData?.weightUnit ?? 'kg',
				package_volume:
					shippingMethodData?.volume ??
					(weightBracket <= 3 ? 9000 : weightBracket <= 6 ? 24000 : 45000), // Volume calculé si null
				package_volume_unit: shippingMethodData?.volumeUnit ?? 'cm3',

				// Adresse
				address_first_name: order.address.first_name,
				address_last_name: order.address.last_name,
				address_phone: order.address.phone,
				address_company: order.address.company,
				address_street_number: order.address.street_number,
				address_street: order.address.street,
				address_city: order.address.city,
				address_county: order.address.county,
				address_state: order.address.state,
				address_stateLetter: order.address.stateLetter,
				address_state_code: order.address.state_code,
				address_zip: order.address.zip,
				address_country: order.address.country,
				address_country_code: order.address.country_code,
				address_ISO_3166_1_alpha_3: order.address.ISO_3166_1_alpha_3,
				address_type: order.address.type,

				// 📍 Point Relais
				servicePointId: order.servicePointId ?? null,
				servicePointPostNumber: order.servicePointPostNumber ?? null,
				servicePointLatitude: order.servicePointLatitude ?? null,
				servicePointLongitude: order.servicePointLongitude ?? null,
				servicePointType: order.servicePointType ?? null,
				servicePointExtraRefCab: order.servicePointExtraRefCab ?? null,
				servicePointExtraShopRef: order.servicePointExtraShopRef ?? null,

				// Produits (JSON)
				invoiceNumber,
				subtotalHt: invoiceTotals.subtotalHt,
				taxRate: invoiceTotals.taxRate,
				taxAmount: invoiceTotals.taxAmount,
				discountAmount: invoiceTotals.discountAmount,
				promoCode: order.promoCode ?? null,

				products: order.items.map((item: any) => ({
					id: item.productId,
					name: item.product.name,
					price: item.price,
					quantity: item.quantity,
					description: item.product.description,
					stock: item.product.stock,
					images: item.product.images,
					customizations: item.custom.map((c: any) => ({
						id: c.id,
						image: c.image,
						userMessage: c.userMessage,
						createdAt: c.createdAt,
						updatedAt: c.updatedAt
					}))
				})),

				// Clés étrangères posées en scalaire : mélanger un `connect` avec le
				// scalaire orderId ne correspond à aucun des deux inputs Prisma.
				userId: userId
			};

			// Crée la transaction dans la BDD
			const newTx = await prismaTx.transaction.create({
				data: transactionData
			});

			await prismaTx.order.update({
				where: { id: orderId },
				data: { status: 'PAID' }
			});

			return newTx;
		});
	} catch (error) {
		log(
			'ERROR',
			'webhook:stripe',
			`❌ Échec de la création de la transaction pour la commande ${orderId}:`,
			error
		);
		return; // on arrête ici si l'enregistrement DB a échoué
	}

	log('INFO', 'webhook:stripe', 'Transaction créée', {
		transactionId: createdTransaction?.id,
		orderId,
		amount: createdTransaction?.amount
	});

	// Facture et Sendcloud partent en deux jobs asynchrones indépendants
	// (QStash si configuré, sinon exécution directe équivalente en dev) : un
	// pic SMTP ou un ralentissement Sendcloud ne doit pas bloquer l'autre.
	// Voir $lib/server/jobs/invoice-email.ts et $lib/server/jobs/post-payment.ts.
	// `allSettled`, pas `all` : la transaction est déjà commitée à ce stade,
	// un rejet d'un job (ex. repli direct en dev sans QStash, débit SMTP
	// atteint) ne doit jamais faire échouer la réponse au webhook Stripe — un
	// job qui échoue via QStash a déjà son propre retry indépendant.
	if (createdTransaction) {
		const jobResults = await Promise.allSettled([
			enqueueInvoiceEmailJob(createdTransaction.id),
			enqueuePostPaymentJob(createdTransaction.id)
		]);
		for (const result of jobResults) {
			if (result.status === 'rejected') {
				log('ERROR', 'webhook:stripe', "Échec d'enfilage d'un job post-paiement", result.reason);
			}
		}
	}

	log('DEBUG', 'webhook:stripe', '=== FIN TRAITEMENT WEBHOOK CHECKOUT ===');
}
