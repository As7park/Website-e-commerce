/**
 * Fixture HTTP du webhook Sendcloud : signature HMAC-SHA256 sur le corps
 * brut, comme le header `Sendcloud-Signature` en production. Voir
 * `src/lib/sendcloud/webhookSignature.ts` pour la vérification côté serveur.
 */
import { createHmac } from 'node:crypto';

export function sendcloudWebhookSecret(): string {
	return process.env.SENDCLOUD_WEBHOOK_SECRET || 'e2e-sendcloud-webhook-secret';
}

export function signSendcloudPayload(rawBody: string, secret = sendcloudWebhookSecret()): string {
	return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

type ParcelStatusChangedFields = {
	parcelId: number;
	trackingNumber?: string;
	statusId?: number;
	statusMessage?: string;
};

/** Corps brut d'un évènement `parcel_status_changed`, prêt à être signé. */
export function parcelStatusChangedPayload(fields: ParcelStatusChangedFields): string {
	return JSON.stringify({
		action: 'parcel_status_changed',
		timestamp: Date.now(),
		carrier_status_change_timestamp: null,
		parcel: {
			id: fields.parcelId,
			tracking_number: fields.trackingNumber ?? `E2E${fields.parcelId}`,
			status: {
				id: fields.statusId ?? 1000,
				message: fields.statusMessage ?? 'Ready to send'
			},
			label: { normal_printer: [], label_printer: '' },
			order_number: `ORDER-e2e-${fields.parcelId}`
		}
	});
}
