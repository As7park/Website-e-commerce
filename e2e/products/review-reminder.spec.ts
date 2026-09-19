import { test, expect } from '../support/fixtures';
import { signUpAndVerify } from '../support/admin';
import {
	backdateOrder,
	createCatalogProduct,
	deleteCatalogProduct,
	getOrderReminderState,
	getStoreFeatureFlags,
	linkProductToOrder,
	requireUser,
	setStoreFeatureFlags
} from '../support/db';
import { clearMailbox, fetchMailbox, waitForEmailContaining } from '../support/mailbox';

const CRON_HEADERS = { authorization: `Bearer ${process.env.CRON_SECRET}` };

/**
 * Relance avis produit post-livraison : scan périodique
 * (`$lib/server/jobs/reviewReminder.ts`, route `/api/jobs/review-reminder`),
 * même mécanique que `cart-recovery.spec.ts` — `Order.updatedAt` reculé via
 * `backdateOrder` pour simuler une commande expédiée depuis plus de 7 jours,
 * sans attendre réellement.
 *
 * `StoreSettings` est une ligne unique partagée par toute la suite : les
 * valeurs d'origine sont restaurées en `finally`.
 */
test.describe('Relance avis produit', () => {
	test.setTimeout(4 * 60_000);

	test('module désactivé : aucune relance envoyée', async ({ page, account }) => {
		const originalFlags = await getStoreFeatureFlags();
		const created = await createCatalogProduct();
		const { product } = created;

		try {
			await setStoreFeatureFlags({ reviewReminderEnabled: false });
			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);
			const { order } = await linkProductToOrder(user.id, product.id, { status: 'SHIPPED' });
			await backdateOrder(order.id, 24 * 10);
			await clearMailbox();

			const response = await page.request.post('/api/jobs/review-reminder', {
				headers: CRON_HEADERS
			});
			expect(response.status()).toBe(200);
			const body = await response.json();
			expect(body.enabled).toBe(false);
			expect(body.sent).toBe(0);

			const state = await getOrderReminderState(order.id);
			expect(state.reviewReminderSentAt).toBeNull();
			expect(await fetchMailbox()).toHaveLength(0);
		} finally {
			await setStoreFeatureFlags(originalFlags);
			await deleteCatalogProduct(product.id);
		}
	});

	test('commande expédiée depuis 10 jours : e-mail envoyé une seule fois', async ({
		page,
		account
	}) => {
		const originalFlags = await getStoreFeatureFlags();
		const created = await createCatalogProduct();
		const { product } = created;

		try {
			await setStoreFeatureFlags({ reviewReminderEnabled: true });
			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);
			const { order } = await linkProductToOrder(user.id, product.id, { status: 'SHIPPED' });

			await test.step('1. Trop récente (2 jours) : pas encore de relance', async () => {
				await backdateOrder(order.id, 24 * 2);
				await clearMailbox();

				const response = await page.request.post('/api/jobs/review-reminder', {
					headers: CRON_HEADERS
				});
				expect(response.status()).toBe(200);
				const body = await response.json();
				expect(body.sent).toBe(0);

				const state = await getOrderReminderState(order.id);
				expect(state.reviewReminderSentAt).toBeNull();
				expect(await fetchMailbox()).toHaveLength(0);
			});

			await test.step('2. 10 jours : relance envoyée avec le lien du produit', async () => {
				await backdateOrder(order.id, 24 * 10);
				await clearMailbox();

				const response = await page.request.post('/api/jobs/review-reminder', {
					headers: CRON_HEADERS
				});
				expect(response.status()).toBe(200);
				const body = await response.json();
				expect(body.sent).toBeGreaterThanOrEqual(1);

				const mail = await waitForEmailContaining(account.email, 'noter vos achats');
				expect(mail.raw).toContain(`/products/${product.slug}#reviews`);

				const state = await getOrderReminderState(order.id);
				expect(state.reviewReminderSentAt).not.toBeNull();
			});

			await test.step('3. Retry : jamais un second e-mail', async () => {
				await clearMailbox();

				const response = await page.request.post('/api/jobs/review-reminder', {
					headers: CRON_HEADERS
				});
				expect(response.status()).toBe(200);
				const body = await response.json();
				expect(body.sent).toBe(0);
				expect(await fetchMailbox()).toHaveLength(0);
			});
		} finally {
			await setStoreFeatureFlags(originalFlags);
			await deleteCatalogProduct(product.id);
		}
	});
});
