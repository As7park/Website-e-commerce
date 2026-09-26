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
 * - des ajouts successifs du même produit se cumulent sur la même ligne ;
 * - modifier la quantité depuis le tiroir panier la clampe au stock et persiste ;
 * - modifier la quantité depuis le récapitulatif checkout persiste également.
 */
test.describe('Commerce — quantité libre', () => {
	test.setTimeout(6 * 60_000);

	test('stock et propagation panier/checkout', async ({ page, account }) => {
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

			await test.step('2. Ajout initial (50) puis second ajout (30) cumulé sur la même ligne', async () => {
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

				// 50 (déjà dans le panier) + 30 = 80, sous le stock de 100 : accepté.
				await quantityInput.fill('30');
				await quantityInput.press('Tab');
				const secondAdd = page.waitForResponse(
					(response) =>
						response.url().includes('/api/save-cart') && response.request().method() === 'POST'
				);
				await page.getByRole('button', { name: 'Ajouter au panier' }).click();
				await secondAdd;

				const pendingAfterSecondAdd = await getPendingOrder(user.id);
				expect(pendingAfterSecondAdd?.items.find((i) => i.productId === product.id)?.quantity).toBe(
					80
				);
			});

			await test.step('3. Tiroir panier : la quantité libre se clampe au stock', async () => {
				await page
					.getByRole('button', { name: /Voir le panier/ })
					.first()
					.click();
				await expect(page.getByRole('heading', { name: 'Votre panier' })).toBeVisible();

				const cartPanel = page.locator('div.p-4', {
					has: page.getByRole('heading', { name: 'Votre panier' })
				});
				const cartQuantityInput = cartPanel.locator('input[type="number"]');
				await expect(cartQuantityInput).toHaveValue('80');

				await cartQuantityInput.fill('150');
				const cartSave = page.waitForResponse(
					(response) =>
						response.url().includes('/api/save-cart') && response.request().method() === 'POST'
				);
				await cartQuantityInput.press('Tab');
				await cartSave;
				await expect(cartQuantityInput).toHaveValue('100');

				const pendingAfterCartClamp = await getPendingOrder(user.id);
				expect(pendingAfterCartClamp?.items.find((i) => i.productId === product.id)?.quantity).toBe(
					100
				);
			});

			await test.step('4. Récapitulatif checkout : même composant, la modification persiste', async () => {
				await page.goto('/checkout');
				await waitForPath(page, '/checkout');

				const checkoutQuantityInput = page.locator('input[type="number"]').first();
				await expect(checkoutQuantityInput).toHaveValue('100');

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
