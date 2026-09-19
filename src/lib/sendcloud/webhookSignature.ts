import { createHmac, timingSafeEqual } from 'node:crypto';

function matchesSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
	const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

	const expectedBuffer = Buffer.from(expected, 'hex');
	const receivedBuffer = Buffer.from(signatureHeader, 'hex');
	if (expectedBuffer.length !== receivedBuffer.length) return false;

	return timingSafeEqual(expectedBuffer, receivedBuffer);
}

/**
 * Vérifie la signature HMAC-SHA256 d'un webhook Sendcloud (header
 * `Sendcloud-Signature`, hex, calculée sur le corps brut de la requête).
 * Voir https://sendcloud.dev/api/v3/webhooks — mêmes principes que la
 * vérification `stripe.webhooks.constructEvent` du webhook Stripe.
 *
 * La doc Sendcloud signe avec le « Secret Key » ou le « Webhook Signature
 * Key » selon le type d'intégration ; les intégrations de type `api` (la
 * nôtre) n'exposent pas de Webhook Signature Key distincte dans leurs
 * réglages, donc `secrets` accepte plusieurs candidats tant que ce n'est pas
 * confirmé en conditions réelles — voir `secretCandidates` ci-dessous.
 */
export function verifySendcloudSignature(
	rawBody: string,
	signatureHeader: string | null,
	secrets: readonly string[]
): string | null {
	if (!signatureHeader) return null;
	return (
		secrets.find((secret) => secret && matchesSignature(rawBody, signatureHeader, secret)) ?? null
	);
}

/** Secrets candidats : `SENDCLOUD_WEBHOOK_SECRET` si configuré, sinon `SENDCLOUD_SECRET_KEY`. */
export function sendcloudWebhookSecretCandidates(): string[] {
	return [process.env.SENDCLOUD_WEBHOOK_SECRET, process.env.SENDCLOUD_SECRET_KEY].filter(
		(value): value is string => !!value
	);
}
