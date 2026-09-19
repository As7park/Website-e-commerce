import { test, expect } from '../support/fixtures';
import { waitForPath } from '../support/flows';
import { signUpAndVerify } from '../support/admin';
import {
	createCatalogProduct,
	deleteCatalogProduct,
	getPendingOrder,
	requireUser
} from '../support/db';

/**
 * Quantité libre (QuantityInput partagé) : fiche produit, tiroir panier et
 * récapitulatif checkout utilisent le même composant. On vérifie que :
 * - la valeur saisie est clampée au stock disponible ;
 * - un ajout qui dépasserait 72 unités cumulées (commandes non-personnalisées)
 *   est intégralement refusé, sans toucher au panier existant ;
 * - modifier la quantité depuis le tiroir panier la clampe à 72 et persiste ;
 * - modifier la quantité depuis le récapitulatif checkout persiste également.
 */
test.describe('Commerce — quantité libre', () => {
	test.setTimeout(6 * 60_000);

	test('stock, plafond 72 unités et propagation panier/checkout', async ({ page, account }) => {
		const created = await createCatalogProduct({ stock: 100 });
		const { product } = created;

		try {
			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);

			await test.step('1. Fiche produit : la saisie libre est clampée au stock affiché', async () => {
				await page.goto(`/products/${product.slug}`);
				await waitForPath(page, `/products/${product.slug}`);

				const quantityInput = page.locator('#quantity-input');
				await quantityInput.fill('500');
				await quantityInput.press('Tab');
				await expect(quantityInput).toHaveValue('100');
			});

			await test.step('2. Ajout initial (50) puis refus au-delà de 72 unités cumulées', async () => {
				const quantityInput = page.locator('#quantity-input');

				await quantityInput.fill('50');
				await quantityInput.press('Tab');

				const firstAdd = page.waitForResponse(
					(response) =>
						response.url().includes('/api/save-cart') && response.request().method() === 'POST'
				);
				await page.getByRole('button', { name: 'Ajouter au panier' }).click();
				await firstAdd;

				const pendingAfterFirstAdd = await getPendingOrder(user.id);
				expect(pendingAfterFirstAdd?.items.find((i) => i.productId === product.id)?.quantity).toBe(
					50
				);

				// 50 (déjà dans le panier) + 30 = 80 > 72 : l'ajout complet est refusé.
				await quantityInput.fill('30');
				await quantityInput.press('Tab');
				await page.getByRole('button', { name: 'Ajouter au panier' }).click();
				await expect(
					page.getByText('Limite de 72 unités pour les commandes non personnalisées.')
				).toBeVisible();

				const pendingAfterRejectedAdd = await getPendingOrder(user.id);
				expect(
					pendingAfterRejectedAdd?.items.find((i) => i.productId === product.id)?.quantity
				).toBe(50);
			});

			await test.step('3. Tiroir panier : la quantité libre se clampe elle-même à 72', async () => {
				await page.locator('.cartButton button').first().click();
				await expect(page.getByRole('heading', { name: 'Votre panier' })).toBeVisible();

				const cartPanel = page.locator('div.p-4', {
					has: page.getByRole('heading', { name: 'Votre panier' })
				});
				const cartQuantityInput = cartPanel.locator('input[type="number"]');
				await expect(cartQuantityInput).toHaveValue('50');

				await cartQuantityInput.fill('100');
				const cartSave = page.waitForResponse(
					(response) =>
						response.url().includes('/api/save-cart') && response.request().method() === 'POST'
				);
				await cartQuantityInput.press('Tab');
				await cartSave;
				await expect(cartQuantityInput).toHaveValue('72');

				const pendingAfterCartClamp = await getPendingOrder(user.id);
				expect(pendingAfterCartClamp?.items.find((i) => i.productId === product.id)?.quantity).toBe(
					72
				);
			});

			await test.step('4. Récapitulatif checkout : même composant, la modification persiste', async () => {
				await page.goto('/checkout');
				await waitForPath(page, '/checkout');

				const checkoutQuantityInput = page.locator('input[type="number"]').first();
				await expect(checkoutQuantityInput).toHaveValue('72');

				await checkoutQuantityInput.fill('60');
				const checkoutSave = page.waitForResponse(
					(response) =>
						response.url().includes('/api/save-cart') && response.request().method() === 'POST'
				);
				await checkoutQuantityInput.press('Tab');
				await checkoutSave;
				await expect(checkoutQuantityInput).toHaveValue('60');

				const pendingAfterCheckoutChange = await getPendingOrder(user.id);
				const item = pendingAfterCheckoutChange?.items.find((i) => i.productId === product.id);
				expect(item?.quantity).toBe(60);
				expect(item?.price).toBeCloseTo(12.5, 5);
			});
		} finally {
			await deleteCatalogProduct(product.id);
		}
	});
});
