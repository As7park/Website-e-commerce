import { test, expect } from '../support/fixtures';
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
 * Webhook Sendcloud (`parcel_status_changed`) : signature + effet sur la
 * commande. Pas d'appel réseau Sendcloud : le corps est signé localement
 * avec le secret e2e (`SENDCLOUD_WEBHOOK_SECRET`).
 */
test.describe('Commerce — webhook Sendcloud', () => {
	test.setTimeout(6 * 60_000);

	test('signature invalide rejetée ; signature valide met à jour le suivi', async ({
		page,
		account
	}) => {
		const created = await createCatalogProduct();
		const { product } = created;

		try {
			// Chauffe le serveur (premier compile SSR lent sur ce projet, cf.
			// les autres specs qui démarrent toutes par une navigation) avant le
			// premier appel API brut ci-dessous — sans page visitée avant, ce
			// POST payait seul le compile à froid dans le budget de 20s de
			// `actionTimeout`, plus large que ce qu'il fallait.
			await page.goto('/', { timeout: 90_000 });

			await occupyEmail(account.email);
			const user = await requireUser(account.email);
			const linked = await linkProductToOrder(user.id, product.id);
			const transaction = await simulatePaidOrder(linked.order.id, user.id, account.email);
			const parcelId = Date.now() % 2_000_000_000;
			await setSendcloudParcelId(transaction.id, parcelId);

			await test.step('1. Signature invalide : rejetée, rien ne change', async () => {
				const payload = parcelStatusChangedPayload({ parcelId });
				const response = await page.request.post('/api/webhooks/sendcloud', {
					headers: {
						'content-type': 'application/json',
						'sendcloud-signature': 'deadbeef'
					},
					data: payload
				});
				expect(response.status()).toBe(401);

				const untouched = await getTransactionById(transaction.id);
				expect(untouched?.shippingStatusMessage).toBeNull();

				const order = await getOrderById(linked.order.id);
				expect(order?.status).toBe('PAID');
			});

			await test.step('2. Signature valide : statut transporteur + commande expédiée', async () => {
				const payload = parcelStatusChangedPayload({
					parcelId,
					statusId: 1000,
					statusMessage: 'Ready to send',
					trackingNumber: `E2E${parcelId}`
				});
				const response = await page.request.post('/api/webhooks/sendcloud', {
					headers: {
						'content-type': 'application/json',
						'sendcloud-signature': signSendcloudPayload(payload)
					},
					data: payload
				});
				expect(response.status()).toBe(200);
				expect(await response.json()).toEqual({ received: true });

				const updated = await getTransactionById(transaction.id);
				expect(updated?.shippingStatusCode).toBe(1000);
				expect(updated?.shippingStatusMessage).toBe('Ready to send');
				expect(updated?.shippingStatusUpdatedAt).not.toBeNull();
				expect(updated?.trackingNumber).toBe(`E2E${parcelId}`);

				const order = await getOrderById(linked.order.id);
				expect(order?.status).toBe('SHIPPED');
			});
		} finally {
			await deleteCatalogProduct(product.id);
		}
	});
});
