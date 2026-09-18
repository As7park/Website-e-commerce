import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server';
import { log } from '$lib/server/log';
import { withLock } from '$lib/server/lock';
import {
	sendcloudWebhookSecretCandidates,
	verifySendcloudSignature
} from '$lib/sendcloud/webhookSignature';

/**
 * Webhook entrant Sendcloud (`parcel_status_changed`).
 *
 * Complète le job post-paiement (`$lib/server/jobs/post-payment.ts`, qui crée
 * la commande + l'étiquette Sendcloud) par le sens inverse : Sendcloud nous
 * notifie ensuite de chaque changement de statut transporteur, affiché tel
 * quel par `OrderTrackingPanel` (`shippingStatusMessage`) — jamais interprété
 * par ce code, sauf pour faire passer la commande en `SHIPPED` au premier
 * statut reçu après paiement (`OrderStatus` n'a pas de granularité plus fine).
 *
 * Toujours répondu 200 une fois la signature validée : un code d'erreur
 * ferait retenter Sendcloud (jusqu'à 10 fois, délai croissant jusqu'à 1h)
 * pour un évènement de toute façon non actionnable (action non gérée,
 * colis inconnu).
 */
export async function POST({ request }: { request: Request }) {
	const signature = request.headers.get('sendcloud-signature');
	const rawBody = await request.text();

	const candidates = sendcloudWebhookSecretCandidates();
	const matched = verifySendcloudSignature(rawBody, signature, candidates);
	if (!matched) {
		log('WARN', 'webhook:sendcloud', 'Signature invalide ou aucun secret configuré');
		return json({ error: 'Invalid signature' }, { status: 401 });
	}
	// Le temps de confirmer en conditions réelles lequel des deux secrets
	// Sendcloud utilise réellement pour ce type d'intégration (`api`).
	log('INFO', 'webhook:sendcloud', 'Signature validée', {
		matchedSecret:
			matched === process.env.SENDCLOUD_SECRET_KEY
				? 'SENDCLOUD_SECRET_KEY'
				: 'SENDCLOUD_WEBHOOK_SECRET'
	});

	let payload: any;
	try {
		payload = JSON.parse(rawBody);
	} catch {
		log('WARN', 'webhook:sendcloud', 'Corps JSON invalide');
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	if (payload?.action !== 'parcel_status_changed') {
		// Pas de log ici avant : un test manuel depuis le panneau Sendcloud
		// ("Test API Webhook") envoie souvent une `action` différente (ping,
		// test générique...) — sans cette ligne, cette réponse 200 immédiate
		// était indiscernable d'une requête qui n'était jamais arrivée.
		log('INFO', 'webhook:sendcloud', `Action non gérée reçue : ${payload?.action ?? '(absente)'}`);
		return json({ received: true }, { status: 200 });
	}

	const parcel = payload.parcel ?? {};
	const parcelId = Number(parcel.id);
	if (!Number.isFinite(parcelId)) {
		log('WARN', 'webhook:sendcloud', "Webhook parcel_status_changed sans 'parcel.id' exploitable");
		return json({ received: true }, { status: 200 });
	}

	try {
		await withLock(`sendcloud:webhook:parcel:${parcelId}`, 30, async () => {
			const transaction = await prisma.transaction.findFirst({
				where: { sendcloudParcelId: parcelId }
			});

			if (!transaction) {
				log('WARN', 'webhook:sendcloud', `Aucune transaction pour le colis Sendcloud ${parcelId}`);
				return;
			}

			const statusCode = Number(parcel.status?.id);
			const statusUpdatedAt =
				typeof payload.timestamp === 'number' ? new Date(payload.timestamp) : new Date();

			await prisma.transaction.update({
				where: { id: transaction.id },
				data: {
					shippingStatusCode: Number.isFinite(statusCode) ? statusCode : null,
					shippingStatusMessage: parcel.status?.message ?? null,
					shippingStatusUpdatedAt: statusUpdatedAt,
					// Défensif : normalement déjà posés par `createSendcloudLabel`, mais
					// ce webhook peut arriver avant la fin de cet appel synchrone.
					trackingNumber: parcel.tracking_number ?? transaction.trackingNumber,
					trackingUrl: parcel.label?.label_printer_url ?? transaction.trackingUrl
				}
			});

			if (transaction.orderId) {
				await prisma.order.updateMany({
					where: { id: transaction.orderId, status: 'PAID' },
					data: { status: 'SHIPPED' }
				});
			}

			log('INFO', 'webhook:sendcloud', 'Statut transporteur mis à jour', {
				transactionId: transaction.id,
				parcelId,
				status: parcel.status?.message
			});
		});
	} catch (error) {
		// Ex. réveil de la base Neon (connexion momentanément fermée) : Sendcloud
		// retente déjà les webhooks en échec (jusqu'à 10 fois, délai croissant),
		// mieux vaut donc un 500 franc ici qu'un 200 qui ferait croire à tort
		// que le statut a été enregistré.
		log(
			'ERROR',
			'webhook:sendcloud',
			`Échec du traitement du webhook pour le colis ${parcelId}`,
			error
		);
		return json({ error: 'Processing failed' }, { status: 500 });
	}

	return json({ received: true }, { status: 200 });
}
