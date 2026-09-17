import { test, expect } from '../support/fixtures';
import { waitForPath } from '../support/flows';
import { pageOrigin, signUpAndVerify } from '../support/admin';
import {
	createCatalogProduct,
	createPaidOrderWithProducts,
	deleteCatalogProduct,
	deleteUser,
	getPendingOrder,
	getStoreFeatureFlags,
	occupyEmail,
	requireUser,
	setStoreFeatureFlags
} from '../support/db';

/**
 * Souvent achetés ensemble (`StoreSettings.frequentlyBoughtTogetherEnabled`) :
 * suggestion dans le panier basée sur l'historique réel de commandes payées
 * (`getFrequentlyBoughtTogether`), remise automatique de 10 % au paiement si
 * les produits liés restent dans le panier (`computeBundleDiscount`, recalculée
 * côté serveur — jamais une valeur transmise par le client).
 *
 * `StoreSettings` est une ligne unique partagée par toute la suite : les
 * valeurs d'origine sont restaurées en `finally`.
 */
test.describe('Souvent achetés ensemble', () => {
	test.setTimeout(6 * 60_000);

	test('module désactivé : aucune suggestion, API refuse', async ({ page, account }) => {
		const { product } = await createCatalogProduct();
		const originalFlags = await getStoreFeatureFlags();

		try {
			await setStoreFeatureFlags({ frequentlyBoughtTogetherEnabled: false });
			await signUpAndVerify(page, account);
			const origin = pageOrigin(page);

			await test.step('1. Panier : pas de bloc suggestion', async () => {
				await page.goto(`/products/${product.slug}`);
				await waitForPath(page, `/products/${product.slug}`);
				await page.getByRole('button', { name: 'Ajouter au panier' }).click();
				await page.locator('.cartButton button').first().click();
				await expect(page.getByRole('heading', { name: 'Votre panier' })).toBeVisible();
				await expect(page.getByText('Souvent achetés ensemble')).toHaveCount(0);
			});

			await test.step('2. API refuse (404)', async () => {
				const response = await page.request.get(`${origin}/api/bundles?productIds=${product.id}`);
				expect(response.status()).toBe(404);
			});
		} finally {
			await setStoreFeatureFlags(originalFlags);
			await deleteCatalogProduct(product.id);
		}
	});

	test('module activé : suggestion depuis l’historique + remise au checkout', async ({
		page,
		account
	}) => {
		const { product: productA } = await createCatalogProduct();
		const { product: productB } = await createCatalogProduct();
		const originalFlags = await getStoreFeatureFlags();

		const historyEmail = `e2e-bundle-history-${Date.now()}@example.test`;
		await occupyEmail(historyEmail);
		const historyUser = await requireUser(historyEmail);
		// Deux commandes payées distinctes contenant les deux produits : seuil
		// minimum (2 commandes) exigé par `getFrequentlyBoughtTogether`.
		await createPaidOrderWithProducts(historyUser.id, [productA.id, productB.id]);
		await createPaidOrderWithProducts(historyUser.id, [productA.id, productB.id]);

		try {
			await setStoreFeatureFlags({ frequentlyBoughtTogetherEnabled: true });
			await signUpAndVerify(page, account);

			await test.step('1. Panier : le produit lié est suggéré', async () => {
				await page.goto(`/products/${productA.slug}`);
				await waitForPath(page, `/products/${productA.slug}`);
				await page.getByRole('button', { name: 'Ajouter au panier' }).click();
				await page.locator('.cartButton button').first().click();
				await expect(page.getByRole('heading', { name: 'Votre panier' })).toBeVisible();
				await expect(page.getByText('Souvent achetés ensemble')).toBeVisible();
				await expect(page.getByText(productB.name)).toBeVisible();
			});

			await test.step('2. Ajout de la suggestion depuis le panier', async () => {
				await page.getByRole('button', { name: 'Ajouter', exact: true }).click();

				const user = await requireUser(account.email);
				await expect
					.poll(async () => {
						const pending = await getPendingOrder(user.id);
						return pending?.items.some((item) => item.productId === productB.id) ?? false;
					})
					.toBe(true);
			});

			await test.step('3. Checkout : remise automatique affichée', async () => {
				await page.goto('/checkout');
				await waitForPath(page, '/checkout');
				await expect(page.getByText('Souvent achetés ensemble » appliquée')).toBeVisible();
			});
		} finally {
			await setStoreFeatureFlags(originalFlags);
			await deleteCatalogProduct(productA.id);
			await deleteCatalogProduct(productB.id);
			await deleteUser(historyEmail);
		}
	});
});
