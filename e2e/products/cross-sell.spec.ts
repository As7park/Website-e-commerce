import { test, expect } from '../support/fixtures';
import {
	createCatalogProduct,
	createLegacyCategory,
	deleteCatalogProduct,
	deleteLegacyCategory,
	getStoreFeatureFlags,
	linkProductToLegacyCategory,
	setStoreFeatureFlags
} from '../support/db';

/**
 * Ventes croisées (`StoreSettings.crossSellEnabled`) : bloc « Vous aimerez
 * aussi » sur la fiche produit, basé sur la catégorie legacy partagée
 * (`ProductCategory`/`Category`, voir `getRelatedProducts` dans `catalog.ts`).
 *
 * `StoreSettings` est une ligne unique partagée par toute la suite : les
 * valeurs d'origine sont restaurées en `finally`.
 */
test.describe('Ventes croisées', () => {
	test.setTimeout(6 * 60_000);

	test('module désactivé masque le bloc, activé affiche les produits de la même catégorie', async ({
		page
	}) => {
		const main = await createCatalogProduct();
		const related = await createCatalogProduct();
		const category = await createLegacyCategory();
		const originalFlags = await getStoreFeatureFlags();

		try {
			await linkProductToLegacyCategory(main.product.id, category.id);
			await linkProductToLegacyCategory(related.product.id, category.id);

			await test.step('1. Module désactivé : bloc absent malgré la catégorie partagée', async () => {
				await setStoreFeatureFlags({ crossSellEnabled: false });
				await page.goto(`/products/${main.product.slug}`);
				await expect(page.getByRole('heading', { name: 'Vous aimerez aussi' })).toHaveCount(0);
			});

			await test.step('2. Module activé : le produit de la même catégorie apparaît', async () => {
				await setStoreFeatureFlags({ crossSellEnabled: true });
				await page.goto(`/products/${main.product.slug}`);
				await expect(page.getByRole('heading', { name: 'Vous aimerez aussi' })).toBeVisible();
				await expect(page.getByRole('link', { name: related.product.name })).toBeVisible();
			});
		} finally {
			await setStoreFeatureFlags(originalFlags);
			await deleteCatalogProduct(main.product.id);
			await deleteCatalogProduct(related.product.id);
			await deleteLegacyCategory(category.id);
		}
	});
});
