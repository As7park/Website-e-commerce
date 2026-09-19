import { test, expect } from '../support/fixtures';
import { signUpAndVerify } from '../support/admin';
import {
	backdateOrder,
	createCatalogProduct,
	deleteCatalogProduct,
	deletePromoCodeByCode,
	getOrderReminderState,
	getStoreFeatureFlags,
	linkProductToOrder,
	requireUser,
	setStoreFeatureFlags
} from '../support/db';
import { clearMailbox, fetchMailbox, waitForEmailContaining } from '../support/mailbox';

const CRON_HEADERS = { authorization: `Bearer ${process.env.CRON_SECRET}` };

/**
 * Relance panier abandonné : scan périodique
 * (`$lib/server/jobs/cartRecovery.ts`, route `/api/jobs/cart-recovery`), pas
 * un job déclenché par une action utilisateur (contrairement à la fidélité
 * ou la facture, enfilés depuis le webhook) — on appelle donc directement la
 * route, avec le même en-tête `CRON_SECRET` que Vercel Cron en repli sans
 * QStash (voir `assertAuthorized` dans la route, identique à
 * `/api/jobs/cleanup`).
 *
 * `Order.updatedAt` est reculé via `backdateOrder` (SQL direct : `@updatedAt`
 * n'est pas surchargeable via un simple `update()` Prisma) pour simuler un
 * panier abandonné depuis 1h30/25h sans attendre réellement.
 *
 * `StoreSettings` est une ligne unique partagée par toute la suite : les
 * valeurs d'origine sont restaurées en `finally`.
 */
test.describe('Relance panier abandonné', () => {
	test.setTimeout(4 * 60_000);

	test('module désactivé : aucune relance envoyée', async ({ page, account }) => {
		const originalFlags = await getStoreFeatureFlags();
		const created = await createCatalogProduct();
		const { product } = created;

		try {
			await setStoreFeatureFlags({ cartRecoveryEnabled: false });
			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);
			const { order } = await linkProductToOrder(user.id, product.id);
			await backdateOrder(order.id, 30);
			await clearMailbox();

			const response = await page.request.post('/api/jobs/cart-recovery', {
				headers: CRON_HEADERS
			});
			expect(response.status()).toBe(200);
			const body = await response.json();
			expect(body.enabled).toBe(false);
			expect(body.reminder1Sent).toBe(0);
			expect(body.reminder2Sent).toBe(0);

			const state = await getOrderReminderState(order.id);
			expect(state.cartReminder1SentAt).toBeNull();
			expect(state.cartReminder2SentAt).toBeNull();
			expect(await fetchMailbox()).toHaveLength(0);
		} finally {
			await setStoreFeatureFlags(originalFlags);
			await deleteCatalogProduct(product.id);
		}
	});

	test('palier 1 (10%) puis palier 2 (15%), jamais deux fois', async ({ page, account }) => {
		const originalFlags = await getStoreFeatureFlags();
		const created = await createCatalogProduct();
		const { product } = created;
		let code1: string | undefined;
		let code2: string | undefined;

		try {
			await setStoreFeatureFlags({ cartRecoveryEnabled: true });
			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);
			const { order } = await linkProductToOrder(user.id, product.id);

			await test.step("1. Panier vieux d'1h30 : palier 1 envoyé, pas le palier 2", async () => {
				await backdateOrder(order.id, 1.5);
				await clearMailbox();

				const response = await page.request.post('/api/jobs/cart-recovery', {
					headers: CRON_HEADERS
				});
				expect(response.status()).toBe(200);
				const body = await response.json();
				expect(body.reminder1Sent).toBeGreaterThanOrEqual(1);
				expect(body.reminder2Sent).toBe(0);

				const mail = await waitForEmailContaining(account.email, 'RELANCE-');
				const match = mail.raw.match(/RELANCE-[A-Z0-9]{4}-[A-Z0-9]{4}/);
				expect(match).not.toBeNull();
				code1 = match?.[0];

				const state = await getOrderReminderState(order.id);
				expect(state.cartReminder1SentAt).not.toBeNull();
				expect(state.cartReminder2SentAt).toBeNull();
			});

			await test.step('2. Rejouer le job tout de suite : pas de second envoi du palier 1', async () => {
				await clearMailbox();
				const response = await page.request.post('/api/jobs/cart-recovery', {
					headers: CRON_HEADERS
				});
				const body = await response.json();
				expect(body.reminder1Sent).toBe(0);
				expect(await fetchMailbox()).toHaveLength(0);
			});

			await test.step('3. Panier vieux de 25h : palier 2 envoyé (code différent)', async () => {
				await backdateOrder(order.id, 25);
				await clearMailbox();

				const response = await page.request.post('/api/jobs/cart-recovery', {
					headers: CRON_HEADERS
				});
				const body = await response.json();
				expect(body.reminder2Sent).toBeGreaterThanOrEqual(1);

				const mail = await waitForEmailContaining(account.email, 'RELANCE-');
				const match = mail.raw.match(/RELANCE-[A-Z0-9]{4}-[A-Z0-9]{4}/);
				expect(match).not.toBeNull();
				code2 = match?.[0];
				expect(code2).not.toBe(code1);

				const state = await getOrderReminderState(order.id);
				expect(state.cartReminder1SentAt).not.toBeNull();
				expect(state.cartReminder2SentAt).not.toBeNull();
			});
		} finally {
			await setStoreFeatureFlags(originalFlags);
			if (code1) await deletePromoCodeByCode(code1);
			if (code2) await deletePromoCodeByCode(code2);
			await deleteCatalogProduct(product.id);
		}
	});
});
