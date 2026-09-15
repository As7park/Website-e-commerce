import { test, expect } from '../support/fixtures';
import { signUpAndVerify } from '../support/admin';
import {
	createCatalogProduct,
	deleteCatalogProduct,
	getStoreFeatureFlags,
	isInWishlistDb,
	requireUser,
	setStoreFeatureFlags
} from '../support/db';

/**
 * Liste d'envies : module activable (`StoreSettings.wishlistEnabled`, 404
 * partout si désactivé), bascule ajout/retrait depuis la fiche produit,
 * retrait depuis `/auth/settings/wishlist`.
 *
 * `StoreSettings` est une ligne unique partagée par toute la suite : les
 * valeurs d'origine sont restaurées en `finally`. La lecture publique
 * (`getStoreFeatureFlags`) n'est mise en cache que si Redis est configuré —
 * ce n'est pas le cas en environnement de test (`.env.test`), donc une
 * écriture directe en base est visible immédiatement.
 */
test.describe('Liste d’envies', () => {
	test.setTimeout(6 * 60_000);

	test('module désactivé ferme tout, activé bascule ajout/retrait', async ({ page, account }) => {
		const created = await createCatalogProduct();
		const originalFlags = await getStoreFeatureFlags();

		try {
			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);

			await test.step('1. Module désactivé : bouton absent, page et API fermées', async () => {
				await setStoreFeatureFlags({ wishlistEnabled: false });

				await page.goto(`/products/${created.product.slug}`);
				await expect(page.getByRole('button', { name: 'Ajouter à la liste d’envies' })).toHaveCount(
					0
				);

				await page.goto('/auth/settings/wishlist');
				await expect(page.getByRole('heading', { name: '404' })).toBeVisible();

				const origin = new URL(page.url()).origin;
				const response = await page.request.post('/api/wishlist', {
					data: { productId: created.product.id },
					headers: { Origin: origin }
				});
				expect(response.status()).toBe(404);
			});

			await test.step('2. Module activé : ajout depuis la fiche produit', async () => {
				await setStoreFeatureFlags({ wishlistEnabled: true });
				await page.goto(`/products/${created.product.slug}`);

				const button = page.getByRole('button', { name: 'Ajouter à la liste d’envies' });
				await expect(button).toBeVisible();
				await button.click();
				await expect(
					page.getByRole('button', { name: 'Retirer de la liste d’envies' })
				).toBeVisible();

				expect(await isInWishlistDb(user.id, created.product.id)).toBe(true);
			});

			await test.step('3. La liste du compte affiche le produit', async () => {
				await page.goto('/auth/settings/wishlist');
				await expect(page.getByRole('heading', { name: created.product.name })).toBeVisible();
			});

			await test.step('4. Retrait depuis la page liste d’envies', async () => {
				await page.getByRole('button', { name: 'Retirer' }).click();
				await expect(page.getByRole('heading', { name: created.product.name })).toHaveCount(0);
				expect(await isInWishlistDb(user.id, created.product.id)).toBe(false);
			});

			await test.step('5. Ré-ajout puis retrait depuis la fiche produit', async () => {
				await page.goto(`/products/${created.product.slug}`);
				await page.getByRole('button', { name: 'Ajouter à la liste d’envies' }).click();
				const removeButton = page.getByRole('button', { name: 'Retirer de la liste d’envies' });
				await expect(removeButton).toBeVisible();
				await removeButton.click();
				await expect(
					page.getByRole('button', { name: 'Ajouter à la liste d’envies' })
				).toBeVisible();
				expect(await isInWishlistDb(user.id, created.product.id)).toBe(false);
			});
		} finally {
			await setStoreFeatureFlags(originalFlags);
			await deleteCatalogProduct(created.product.id);
		}
	});

	test('anonyme ne peut pas basculer la liste d’envies', async ({ page }) => {
		const created = await createCatalogProduct();
		const originalFlags = await getStoreFeatureFlags();

		try {
			await setStoreFeatureFlags({ wishlistEnabled: true });
			await page.goto(`/products/${created.product.slug}`);
			const response = await page.request.post('/api/wishlist', {
				data: { productId: created.product.id },
				headers: { Origin: new URL(page.url()).origin }
			});
			expect(response.status()).toBe(401);
		} finally {
			await setStoreFeatureFlags(originalFlags);
			await deleteCatalogProduct(created.product.id);
		}
	});
});
