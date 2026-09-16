import { test, expect } from '../support/fixtures';
import { hasLiveSendcloud } from '../support/third-party';
import {
	createCatalogProduct,
	deleteCatalogProduct,
	getOrderById,
	getTransactionById,
	linkProductToOrder,
	occupyEmail,
	requireUser,
	setSendcloudParcelId,
	simulatePaidOrder
} from '../support/db';
import { parcelStatusChangedPayload, signSendcloudPayload } from '../support/sendcloud';

/**
 * Boucle complète Sendcloud, réseau réel : vraie création d'étiquette (option
 * gratuite « lettre non affranchie », voir docs/commerce/README.md) puis vrai
 * webhook signé vers `/api/webhooks/sendcloud` avec le `parcelId` réellement
 * renvoyé. `PUBLIC_ENV=test` bloque `shouldCallSendcloud()` côté job
 * post-paiement et aucune route HTTP légitime n'expose `runPostPaymentJob` en
 * e2e (`/api/jobs/post-payment` exige une signature QStash absente en test) :
 * ce test appelle donc Sendcloud directement depuis le process de test, même
 * contournement que `e2e/support/db.ts`/`e2e/support/sendcloud.ts` pratiquent
 * déjà pour leurs propres besoins — pas une route applicative testée ici,
 * mais le contrat Sendcloud + le webhook entrant, bout en bout.
 */
function sendcloudAuthHeader(): string {
	const pub = process.env.SENDCLOUD_PUBLIC_KEY;
	const sec = process.env.SENDCLOUD_SECRET_KEY;
	if (!pub || !sec) throw new Error('Sendcloud credentials missing');
	return 'Basic ' + Buffer.from(`${pub}:${sec}`).toString('base64');
}

test.describe('Live — étiquette Sendcloud + webhook', () => {
	test.setTimeout(6 * 60_000);
	test.skip(!hasLiveSendcloud(), 'SENDCLOUD_* factices : pas d’appel Sendcloud');

	test('création réelle (lettre non affranchie) puis webhook signé met à jour le suivi', async ({
		page,
		account
	}) => {
		const created = await createCatalogProduct();
		const { product } = created;

		try {
			await page.goto('/', { timeout: 90_000 });

			await occupyEmail(account.email);
			const user = await requireUser(account.email);
			const linked = await linkProductToOrder(user.id, product.id);
			const transaction = await simulatePaidOrder(linked.order.id, user.id, account.email);

			let realParcelId = 0;
			let realTrackingNumber = '';

			await test.step("1. Vraie création d'étiquette (POST v3/shipments/announce)", async () => {
				const response = await fetch('https://panel.sendcloud.sc/api/v3/shipments/announce', {
					method: 'POST',
					headers: {
						Authorization: sendcloudAuthHeader(),
						'Content-Type': 'application/json',
						Accept: 'application/json'
					},
					body: JSON.stringify({
						from_address: {
							name: 'MadeInDiamonds',
							address_line_1: '123 Rue des Affaires',
							postal_code: '75000',
							city: 'Paris',
							country_code: 'FR'
						},
						to_address: {
							name: 'E2E Live Test',
							address_line_1: 'Rue de la Paix',
							house_number: '10',
							postal_code: '75002',
							city: 'Paris',
							country_code: 'FR',
							phone_number: '+33600000000'
						},
						ship_with: {
							type: 'shipping_option_code',
							properties: { shipping_option_code: 'sendcloud:letter' }
						},
						parcels: [
							{
								weight: { value: 0.05, unit: 'kg' },
								dimensions: { length: 20, width: 15, height: 2, unit: 'cm' }
							}
						],
						order_number: `E2E-${transaction.id}`,
						external_reference_id: transaction.id
					})
				});

				const data: any = await response.json().catch(() => ({}));
				expect(response.ok, JSON.stringify(data)).toBe(true);

				const parcelId = Number(data?.parcels?.[0]?.id ?? data?.id);
				expect(Number.isFinite(parcelId)).toBe(true);
				realParcelId = parcelId;
				realTrackingNumber =
					data?.tracking_number ?? data?.parcels?.[0]?.tracking_number ?? `E2E${parcelId}`;

				await setSendcloudParcelId(transaction.id, realParcelId);
			});

			await test.step('2. Webhook signé avec le vrai parcelId : suivi + commande expédiée', async () => {
				const payload = parcelStatusChangedPayload({
					parcelId: realParcelId,
					trackingNumber: realTrackingNumber,
					statusId: 1000,
					statusMessage: 'Ready to send'
				});
				const response = await page.request.post('/api/webhooks/sendcloud', {
					headers: {
						'content-type': 'application/json',
						'sendcloud-signature': signSendcloudPayload(payload)
					},
					data: payload
				});
				expect(response.status()).toBe(200);

				const updated = await getTransactionById(transaction.id);
				expect(updated?.shippingStatusCode).toBe(1000);
				expect(updated?.shippingStatusMessage).toBe('Ready to send');
				expect(updated?.trackingNumber).toBe(realTrackingNumber);

				const order = await getOrderById(linked.order.id);
				expect(order?.status).toBe('SHIPPED');
			});
		} finally {
			await deleteCatalogProduct(product.id);
		}
	});
});
