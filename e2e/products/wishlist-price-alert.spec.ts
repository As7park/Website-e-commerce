import { test, expect } from '../support/fixtures';
import { signUpAndVerify } from '../support/admin';
import { waitForPath, waitForAppReady } from '../support/flows';
import {
	createCatalogProduct,
	deleteCatalogProduct,
	getStoreFeatureFlags,
	getWishlistItem,
	promoteToAdmin,
	requireUser,
	setStoreFeatureFlags
} from '../support/db';
import { clearMailbox, fetchMailbox, waitForEmailContaining } from '../support/mailbox';

/**
 * Alerte wishlist (baisse de prix / vente flash) : fait converger deux
 * modules déjà en place (Liste d'envies, Vente flash) sans nouveau concept
 * — event-triggered depuis `updateProductById` (seul point d'écriture de
 * `price`/`flashSaleEndsAt`, voir `$lib/server/jobs/wishlistPriceAlert.ts`),
 * en fallback synchrone dans la requête admin quand QStash n'est pas
 * configuré (cas e2e), même mécanique que `stock-alerts.spec.ts`.
 *
 * Idempotence par valeur (`WishlistItem.lastNotifiedPrice`/
 * `lastNotifiedFlashSaleEndsAt`) : une même baisse ou une même vente flash
 * ne redéclenche jamais une alerte, mais une nouvelle baisse ou une
 * nouvelle vente flash le fait normalement.
 *
 * `StoreSettings` est une ligne unique partagée par toute la suite : les
 * valeurs d'origine sont restaurées en `finally`.
 */
test.describe('Alerte wishlist : baisse de prix / vente flash', () => {
	test.setTimeout(6 * 60_000);

	test('module désactivé : aucune alerte envoyée', async ({ page, account }) => {
		const originalFlags = await getStoreFeatureFlags();
		const created = await createCatalogProduct({ price: 100 });
		const { product } = created;

		try {
			await setStoreFeatureFlags({ wishlistEnabled: true, wishlistPriceAlertEnabled: false });

			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);
			await promoteToAdmin(account.email);

			await page.goto(`/products/${product.slug}`);
			await page.getByRole('button', { name: 'Ajouter à la liste d’envies' }).click();
			await expect(
				page.getByRole('button', { name: 'Retirer de la liste d’envies' })
			).toBeVisible();

			await clearMailbox();

			await page.goto(`/admin/products/${product.id}`, { waitUntil: 'domcontentloaded' });
			await waitForAppReady(page);
			await expect(page.getByText('Price', { exact: true })).toBeVisible({ timeout: 30_000 });
			await page.locator('input[name="price"]').fill('80');
			await page.getByRole('button', { name: 'Save changes' }).click();
			await waitForPath(page, '/admin/products');

			expect(await fetchMailbox()).toHaveLength(0);
			const item = await getWishlistItem(user.id, product.id);
			expect(item?.lastNotifiedPrice).toBe(100);
		} finally {
			await setStoreFeatureFlags(originalFlags);
			await deleteCatalogProduct(product.id);
		}
	});

	test('baisse de prix puis vente flash : alertes envoyées, jamais deux fois pour la même valeur', async ({
		page,
		account
	}) => {
		const originalFlags = await getStoreFeatureFlags();
		const created = await createCatalogProduct({ price: 100 });
		const { product } = created;
		// Valeur explicite réutilisée telle quelle étape 5 puis 6 : le champ
		// `flashSaleEndsAt` réaffiche la date enregistrée via `toISOString()`
		// (UTC) mais `new Date(...)` sans suffixe `Z` l'interprète en heure
		// locale du serveur — un simple rechargement de page décalerait donc la
		// valeur si le fuseau local n'est pas UTC ; on ressaisit ici la même
		// chaîne explicite plutôt que de se fier au round-trip d'affichage.
		const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

		try {
			await setStoreFeatureFlags({
				wishlistEnabled: true,
				wishlistPriceAlertEnabled: true,
				flashSaleEnabled: true
			});

			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);
			await promoteToAdmin(account.email);

			await test.step("1. Ajout à la liste d'envies (baseline = prix courant)", async () => {
				await page.goto(`/products/${product.slug}`);
				await page.getByRole('button', { name: 'Ajouter à la liste d’envies' }).click();
				await expect(
					page.getByRole('button', { name: 'Retirer de la liste d’envies' })
				).toBeVisible();

				const item = await getWishlistItem(user.id, product.id);
				expect(item?.lastNotifiedPrice).toBe(100);
				expect(item?.lastNotifiedFlashSaleEndsAt).toBeNull();
			});

			await test.step('2. Baisse de prix admin déclenche une alerte', async () => {
				await clearMailbox();
				await page.goto(`/admin/products/${product.id}`, { waitUntil: 'domcontentloaded' });
				await waitForAppReady(page);
				await expect(page.getByText('Price', { exact: true })).toBeVisible({ timeout: 30_000 });
				await page.locator('input[name="price"]').fill('80');
				await page.getByRole('button', { name: 'Save changes' }).click();
				await waitForPath(page, '/admin/products');

				await waitForEmailContaining(account.email, product.name);
				const item = await getWishlistItem(user.id, product.id);
				expect(item?.lastNotifiedPrice).toBe(80);
			});

			await test.step('3. Ré-enregistrer le même prix ne renvoie rien', async () => {
				await clearMailbox();
				await page.goto(`/admin/products/${product.id}`, { waitUntil: 'domcontentloaded' });
				await waitForAppReady(page);
				await expect(page.getByText('Price', { exact: true })).toBeVisible({ timeout: 30_000 });
				await page.locator('input[name="price"]').fill('80');
				await page.getByRole('button', { name: 'Save changes' }).click();
				await waitForPath(page, '/admin/products');

				expect(await fetchMailbox()).toHaveLength(0);
			});

			await test.step('4. Nouvelle baisse redéclenche une alerte', async () => {
				await clearMailbox();
				await page.goto(`/admin/products/${product.id}`, { waitUntil: 'domcontentloaded' });
				await waitForAppReady(page);
				await expect(page.getByText('Price', { exact: true })).toBeVisible({ timeout: 30_000 });
				await page.locator('input[name="price"]').fill('60');
				await page.getByRole('button', { name: 'Save changes' }).click();
				await waitForPath(page, '/admin/products');

				await waitForEmailContaining(account.email, product.name);
				const item = await getWishlistItem(user.id, product.id);
				expect(item?.lastNotifiedPrice).toBe(60);
			});

			await test.step('5. Nouvelle vente flash déclenche une alerte', async () => {
				await clearMailbox();
				await page.goto(`/admin/products/${product.id}`, { waitUntil: 'domcontentloaded' });
				await waitForAppReady(page);
				await expect(page.getByText('Price', { exact: true })).toBeVisible({ timeout: 30_000 });
				await page.locator('input[name="flashSaleEndsAt"]').fill(futureDate);
				await page.getByRole('button', { name: 'Save changes' }).click();
				await waitForPath(page, '/admin/products');

				await waitForEmailContaining(account.email, product.name);
				const item = await getWishlistItem(user.id, product.id);
				expect(item?.lastNotifiedFlashSaleEndsAt).not.toBeNull();
			});

			await test.step('6. Ré-enregistrer la même vente flash ne renvoie rien', async () => {
				await clearMailbox();
				await page.goto(`/admin/products/${product.id}`, { waitUntil: 'domcontentloaded' });
				await waitForAppReady(page);
				await expect(page.getByText('Price', { exact: true })).toBeVisible({ timeout: 30_000 });
				await page.locator('input[name="flashSaleEndsAt"]').fill(futureDate);
				await page.getByRole('button', { name: 'Save changes' }).click();
				await waitForPath(page, '/admin/products');

				expect(await fetchMailbox()).toHaveLength(0);
			});
		} finally {
			await setStoreFeatureFlags(originalFlags);
			await deleteCatalogProduct(product.id);
		}
	});
});
