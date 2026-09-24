import { test, expect } from '../support/fixtures';
import { signUpAndVerify } from '../support/admin';
import {
	createCatalogProduct,
	createProductView,
	deleteCatalogProduct,
	getProductViewState,
	getStoreFeatureFlags,
	linkProductToOrder,
	requireUser,
	setStoreFeatureFlags
} from '../support/db';
import { clearMailbox, fetchMailbox, waitForEmailContaining } from '../support/mailbox';

const CRON_HEADERS = { authorization: `Bearer ${process.env.CRON_SECRET}` };

/**
 * Relance « produits consultés, jamais achetés » : scan périodique
 * (`$lib/server/jobs/recentlyViewedReminder.ts`, route
 * `/api/jobs/recently-viewed-reminder`), même mécanique que
 * `review-reminder.spec.ts` — `ProductView.viewedAt` reculé via
 * `createProductView` pour simuler une consultation ancienne, sans attendre
 * réellement.
 *
 * `StoreSettings` est une ligne unique partagée par toute la suite : les
 * valeurs d'origine sont restaurées en `finally`.
 */
test.describe('Relance produits consultés', () => {
	test.setTimeout(4 * 60_000);

	test('module désactivé : aucune relance envoyée', async ({ page, account }) => {
		const originalFlags = await getStoreFeatureFlags();
		const created = await createCatalogProduct();
		const { product } = created;

		try {
			await setStoreFeatureFlags({ recentlyViewedReminderEnabled: false });
			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);
			await createProductView(user.id, product.id, {
				viewedAt: new Date(Date.now() - 48 * 60 * 60 * 1000)
			});
			await clearMailbox();

			const response = await page.request.post('/api/jobs/recently-viewed-reminder', {
				headers: CRON_HEADERS
			});
			expect(response.status()).toBe(200);
			const body = await response.json();
			expect(body.enabled).toBe(false);
			expect(body.sent).toBe(0);

			const state = await getProductViewState(user.id, product.id);
			expect(state.reminderSentAt).toBeNull();
			expect(await fetchMailbox()).toHaveLength(0);
		} finally {
			await setStoreFeatureFlags(originalFlags);
			await deleteCatalogProduct(product.id);
		}
	});

	test('consultation de 48h non achetée : digest envoyé une seule fois', async ({
		page,
		account
	}) => {
		const originalFlags = await getStoreFeatureFlags();
		const created = await createCatalogProduct();
		const { product } = created;

		try {
			await setStoreFeatureFlags({ recentlyViewedReminderEnabled: true });
			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);

			await test.step('1. Trop récente (2h) : pas encore de relance', async () => {
				await createProductView(user.id, product.id, {
					viewedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
				});
				await clearMailbox();

				const response = await page.request.post('/api/jobs/recently-viewed-reminder', {
					headers: CRON_HEADERS
				});
				expect(response.status()).toBe(200);
				const body = await response.json();
				expect(body.sent).toBe(0);

				const state = await getProductViewState(user.id, product.id);
				expect(state.reminderSentAt).toBeNull();
				expect(await fetchMailbox()).toHaveLength(0);
			});

			await test.step('2. 48h, jamais achetée : digest envoyé avec le lien produit', async () => {
				await createProductView(user.id, product.id, {
					viewedAt: new Date(Date.now() - 48 * 60 * 60 * 1000)
				});
				await clearMailbox();

				const response = await page.request.post('/api/jobs/recently-viewed-reminder', {
					headers: CRON_HEADERS
				});
				expect(response.status()).toBe(200);
				const body = await response.json();
				expect(body.sent).toBeGreaterThanOrEqual(1);

				const mail = await waitForEmailContaining(account.email, 'Toujours envie de craquer');
				expect(mail.raw).toContain(`/products/${product.slug}`);

				const state = await getProductViewState(user.id, product.id);
				expect(state.reminderSentAt).not.toBeNull();
			});

			await test.step('3. Retry : jamais un second e-mail', async () => {
				await clearMailbox();

				const response = await page.request.post('/api/jobs/recently-viewed-reminder', {
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

	test('produit acheté entre-temps : jamais dans le digest', async ({ page, account }) => {
		const originalFlags = await getStoreFeatureFlags();
		const created = await createCatalogProduct();
		const { product } = created;

		try {
			await setStoreFeatureFlags({ recentlyViewedReminderEnabled: true });
			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);

			await createProductView(user.id, product.id, {
				viewedAt: new Date(Date.now() - 48 * 60 * 60 * 1000)
			});
			// Achat réel entre la consultation et la relance (statut payé).
			await linkProductToOrder(user.id, product.id, { status: 'PAID' });
			await clearMailbox();

			const response = await page.request.post('/api/jobs/recently-viewed-reminder', {
				headers: CRON_HEADERS
			});
			expect(response.status()).toBe(200);
			const body = await response.json();
			expect(body.sent).toBe(0);

			const state = await getProductViewState(user.id, product.id);
			expect(state.reminderSentAt).toBeNull();
			expect(await fetchMailbox()).toHaveLength(0);
		} finally {
			await setStoreFeatureFlags(originalFlags);
			await deleteCatalogProduct(product.id);
		}
	});
});
