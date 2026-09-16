import { prisma } from '$lib/server';
import { withLock } from '$lib/server/lock';
import { createSendcloudOrder } from '$lib/sendcloud/order';
import { createSendcloudLabel } from '$lib/sendcloud/label';
import { log } from '$lib/server/log';
import { withCircuitBreaker } from '$lib/server/circuit-breaker';
import { recordJobAttempt, resetJobAttempts } from '$lib/server/job-attempts';
import { withDuration } from '$lib/server/metrics';
import * as Sentry from '@sentry/sveltekit';
import { estimatePackage, type PackageEstimate } from '$lib/commerce/packageEstimate';

/** Au-delà, on arrête de retenter cette transaction (dead-letter) : voir `runPostPaymentJob`. */
const MAX_SENDCLOUD_ATTEMPTS = 5;

/**
 * Travail post-paiement : Sendcloud (commande + étiquette), sorti du chemin
 * synchrone du webhook Stripe (`src/routes/api/webhooks/+server.ts`). La
 * facture part dans son propre job (`$lib/server/jobs/invoice-email.ts`) —
 * les deux sont enqueue en parallèle, sans dépendance de l'un vers l'autre.
 * Appelé soit directement (repli sans QStash, `$lib/server/qstash.ts`), soit
 * depuis `src/routes/api/jobs/post-payment/+server.ts` via QStash — d'où le
 * rechargement de tout depuis la base par id : un job ne doit pas fermer sur
 * des objets en mémoire d'une requête HTTP déjà terminée.
 */

/** SENDCLOUD : pas d'appel réseau en e2e (`PUBLIC_ENV=test`) ni sans clés. */
export function shouldCallSendcloud(): boolean {
	if (process.env.PUBLIC_ENV === 'test') return false;
	const pub = process.env.SENDCLOUD_PUBLIC_KEY ?? '';
	const sec = process.env.SENDCLOUD_SECRET_KEY ?? '';
	return pub.length > 0 && sec.length > 0;
}

export function fallbackShippingMethod(shippingOption: string, pkg: PackageEstimate) {
	return {
		id: 9999,
		name: `Méthode: ${shippingOption}`,
		length: pkg.lengthCm,
		width: pkg.widthCm,
		height: pkg.heightCm,
		unit: 'cm',
		weight: pkg.weightKg,
		weightUnit: 'kg',
		volume: pkg.lengthCm * pkg.widthCm * pkg.heightCm,
		volumeUnit: 'cm3'
	};
}

/**
 * Estimation réelle du colis (poids + dimensions) à partir des produits de la
 * commande — même module que le devis checkout (`packageEstimate.ts`), pour
 * que le colis créé chez Sendcloud corresponde au devis affiché au client.
 */
export function derivePackageEstimate(order: any): PackageEstimate {
	if (!order || !order.items || !Array.isArray(order.items)) {
		log('WARN', 'post-payment', "Impossible d'estimer le colis : 'order.items' est invalide.");
		return estimatePackage([{ quantity: 1 }]);
	}

	return estimatePackage(
		order.items.map((item: any) => ({
			quantity: item.quantity,
			hasCustom: (item.custom?.length ?? 0) > 0,
			product: item.product
		}))
	);
}

/**
 * Récupère l'objet { id, name } directement depuis Sendcloud en utilisant
 * l'API des méthodes d'expédition.
 */
export async function getShippingMethodData(
	shippingOption: string,
	pkg: PackageEstimate,
	order: any
) {
	if (!shouldCallSendcloud()) {
		return fallbackShippingMethod(shippingOption, pkg);
	}

	log('DEBUG', 'post-payment:sendcloud-method', 'Paramètres:', { shippingOption, pkg });

	try {
		const methodsResponse = await fetch('https://panel.sendcloud.sc/api/v2/shipping_methods', {
			method: 'GET',
			headers: {
				Authorization: `Basic ${Buffer.from(`${process.env.SENDCLOUD_PUBLIC_KEY || ''}:${process.env.SENDCLOUD_SECRET_KEY || ''}`).toString('base64')}`,
				'Content-Type': 'application/json'
			}
		});

		if (!methodsResponse.ok) {
			throw new Error(`Sendcloud Methods API error: ${methodsResponse.status}`);
		}

		const methodsData = await methodsResponse.json();
		log(
			'DEBUG',
			'post-payment:sendcloud-method',
			"Méthodes d'expédition reçues:",
			methodsData.shipping_methods?.length || 0
		);

		const baseCode = shippingOption.split('/')[0];

		let matchingMethod = null;
		if (methodsData.shipping_methods && Array.isArray(methodsData.shipping_methods)) {
			matchingMethod = methodsData.shipping_methods.find((method: any) => {
				const methodName = method.name?.toLowerCase() || '';
				const methodCarrier = method.carrier?.toLowerCase() || '';
				const optionCode = shippingOption.toLowerCase();
				const baseCodeLower = baseCode.toLowerCase();

				if (methodCarrier && baseCodeLower.includes(methodCarrier)) {
					return true;
				}

				if (methodName && optionCode.includes(methodName.replace(/\s+/g, ''))) {
					return true;
				}

				return false;
			});
		}

		if (matchingMethod) {
			const dynamicMethod = {
				id: matchingMethod.id, // ID réel de Sendcloud !
				name: `${matchingMethod.carrier || 'Unknown'} - ${matchingMethod.name || 'Unknown'}`,
				length: pkg.lengthCm,
				width: pkg.widthCm,
				height: pkg.heightCm,
				unit: 'cm',
				weight: pkg.weightKg,
				weightUnit: 'kg',
				volume: pkg.lengthCm * pkg.widthCm * pkg.heightCm,
				volumeUnit: 'cm3'
			};

			log(
				'DEBUG',
				'post-payment:sendcloud-method',
				"Méthode d'expédition dynamique créée avec ID Sendcloud:",
				dynamicMethod
			);
			return dynamicMethod;
		}

		log(
			'WARN',
			'post-payment:sendcloud-method',
			'Aucune méthode correspondante trouvée, fallback',
			{
				shippingOption
			}
		);
		return fallbackShippingMethod(shippingOption, pkg);
	} catch (error) {
		log(
			'ERROR',
			'post-payment:sendcloud-method',
			"Erreur lors de la récupération des méthodes d'expédition, fallback",
			error
		);
		return fallbackShippingMethod(shippingOption, pkg);
	}
}

/**
 * Facture + Sendcloud pour une transaction payée. Sous verrou distribué
 * (`post-payment:<id>`) : QStash peut relivrer le même message après un
 * échec partiel, et la commande/étiquette Sendcloud ont un coût réel — pas
 * question d'en recréer une seconde en double sur retry.
 *
 * Contrairement aux anciens `try/catch` qui avalaient toute erreur (un échec
 * Sendcloud/SMTP n'était donc jamais retenté), les erreurs remontent ici :
 * c'est ce qui déclenche le retry QStash côté appelant HTTP.
 */
export async function runPostPaymentJob(transactionId: string): Promise<void> {
	await withDuration('job.post-payment', () =>
		withLock(`post-payment:${transactionId}`, 60, async () => {
			let transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
			if (!transaction) {
				log(
					'ERROR',
					'post-payment',
					`Transaction introuvable pour le job post-paiement: ${transactionId}`
				);
				return;
			}

			if (transaction.status !== 'paid') {
				log(
					'WARN',
					'post-payment',
					'Statut de paiement non "paid", job post-paiement ignoré. Statut:',
					transaction.status
				);
				return;
			}

			if (!shouldCallSendcloud()) {
				log('DEBUG', 'post-payment', 'Sendcloud ignoré (PUBLIC_ENV=test ou clés absentes)');
				return;
			}

			const sendcloudAttemptsKey = `sendcloud:${transactionId}`;

			try {
				const orderForShipping = transaction.orderId
					? await prisma.order.findUnique({
							where: { id: transaction.orderId },
							include: { items: { include: { product: true, custom: true } } }
						})
					: null;
				const packageEstimate = derivePackageEstimate(orderForShipping);
				const shippingMethodData = await getShippingMethodData(
					transaction.shippingOption || '',
					packageEstimate,
					orderForShipping
				);

				if (shippingMethodData?.id && shippingMethodData.id !== transaction.shippingMethodId) {
					transaction = await prisma.transaction.update({
						where: { id: transaction.id },
						data: {
							shippingMethodId: shippingMethodData.id,
							shippingMethodName: shippingMethodData.name,
							package_length: shippingMethodData.length,
							package_width: shippingMethodData.width,
							package_height: shippingMethodData.height,
							package_dimension_unit: shippingMethodData.unit,
							package_weight: shippingMethodData.weight,
							package_weight_unit: shippingMethodData.weightUnit,
							package_volume: shippingMethodData.volume,
							package_volume_unit: shippingMethodData.volumeUnit
						}
					});
				}

				if (!transaction.sendcloudOrderCreatedAt) {
					const transactionForOrder = transaction;
					await withCircuitBreaker('sendcloud', () => createSendcloudOrder(transactionForOrder));
					transaction = await prisma.transaction.update({
						where: { id: transaction.id },
						data: { sendcloudOrderCreatedAt: new Date() }
					});
				} else {
					log('DEBUG', 'post-payment', 'Commande Sendcloud déjà créée, appel ignoré');
				}

				if (!transaction.sendcloudParcelId) {
					const transactionForLabel = transaction;
					await withCircuitBreaker('sendcloud', () => createSendcloudLabel(transactionForLabel));
				} else {
					log('DEBUG', 'post-payment', 'Étiquette Sendcloud déjà créée, appel ignoré');
				}

				await resetJobAttempts(sendcloudAttemptsKey);
				log('INFO', 'post-payment', 'Job post-paiement terminé', { transactionId: transaction.id });
			} catch (error) {
				// Le disjoncteur (`$lib/server/circuit-breaker.ts`) protège Sendcloud
				// pendant une panne ; ce compteur protège QStash contre un retry sans
				// fin sur LA MÊME transaction une fois le disjoncteur refermé.
				const { attempt, exhausted } = await recordJobAttempt(
					sendcloudAttemptsKey,
					MAX_SENDCLOUD_ATTEMPTS
				);

				if (exhausted) {
					log(
						'ERROR',
						'post-payment',
						`Sendcloud abandonné après ${attempt} tentatives (dead-letter) pour la transaction ${transactionId}`,
						error
					);
					Sentry.captureException(error, {
						tags: { deadLetter: 'sendcloud', transactionId }
					});
					// Ne relance pas l'erreur : QStash arrêterait sinon de retenter, ce qui
					// est justement le but ici — la transaction reste identifiable en base
					// (sendcloudOrderCreatedAt/sendcloudParcelId absents) pour un
					// retraitement manuel ultérieur, sans marteler Sendcloud indéfiniment.
					return;
				}

				log(
					'WARN',
					'post-payment',
					`Échec Sendcloud (tentative ${attempt}/${MAX_SENDCLOUD_ATTEMPTS}), nouvel essai via retry QStash`,
					error
				);
				throw error;
			}
		})
	);
}
