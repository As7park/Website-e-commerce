import { test, expect } from '../support/fixtures';
import { waitForPath } from '../support/flows';
import { pageOrigin, signUpAndVerify } from '../support/admin';
import {
	createCatalogProduct,
	createProductVariant,
	deleteCatalogProduct,
	deleteProductVariant,
	deleteUser,
	getPendingOrder,
	getProductVariantById,
	linkProductToOrder,
	occupyEmail,
	promoteToAdmin,
	requireUser
} from '../support/db';

/**
 * Variantes produit (`ProductVariant`) : étiquette libre + stock/prix propres.
 * Sélection sur la fiche produit, ligne de panier distincte par variante
 * (jamais fusionnée avec une autre variante du même produit), stock
 * plafonné par variante, et CRUD admin (voir aussi la garde FK Restrict :
 * une variante déjà commandée ne peut pas être supprimée).
 */
test.describe('Variantes produit', () => {
	test.setTimeout(6 * 60_000);

	test('sélection sur la fiche, panier par variante, stock plafonné', async ({ page, account }) => {
		const created = await createCatalogProduct();
		const variantA = await createProductVariant(created.product.id, {
			label: 'Taille 52',
			stock: 2
		});
		const variantB = await createProductVariant(created.product.id, {
			label: 'Taille 54',
			price: 25,
			stock: 1
		});

		try {
			await signUpAndVerify(page, account);
			await page.goto(`/products/${created.product.slug}`);

			await test.step('1. Le sélecteur propose les deux variantes', async () => {
				await expect(page.getByText('Variante')).toBeVisible();
				await page.getByRole('button', { name: 'Variante' }).click();
				await expect(page.getByRole('option', { name: 'Taille 52' })).toBeVisible();
				await expect(page.getByRole('option', { name: 'Taille 54' })).toBeVisible();
			});

			await test.step('2. Choisir la variante au prix surchargé met à jour l’affichage', async () => {
				await page.getByRole('option', { name: 'Taille 54' }).click();
				await expect(page.getByText('25.00 €', { exact: true })).toBeVisible();
				await expect(page.getByText('Stock : 1')).toBeVisible();
			});

			await test.step('3. Ajout au panier : la ligne porte la variante et son prix', async () => {
				const save = page.waitForResponse(
					(response) =>
						response.url().includes('/api/save-cart') && response.request().method() === 'POST'
				);
				await page.getByRole('button', { name: 'Ajouter au panier' }).click();
				await save;

				const user = await requireUser(account.email);
				const order = await getPendingOrder(user.id);
				expect(order?.items).toHaveLength(1);
				expect(order?.items[0].variantId).toBe(variantB.id);
				expect(order?.items[0].price).toBeCloseTo(25, 2);
			});

			await test.step('4. Le panier affiche la variante distinctement', async () => {
				await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
				await waitForPath(page, '/checkout');
				await expect(page.getByText('— Taille 54')).toBeVisible();
				await expect(page.getByText("25.00€ l'unité")).toBeVisible();
			});
		} finally {
			await deleteProductVariant(variantA.id);
			await deleteProductVariant(variantB.id);
			await deleteCatalogProduct(created.product.id);
		}
	});

	test('administration : création, édition, et refus de suppression si commandée', async ({
		page,
		account
	}) => {
		const created = await createCatalogProduct();
		const removable = await createProductVariant(created.product.id, {
			label: 'e2e-var-removable',
			stock: 5
		});
		const locked = await createProductVariant(created.product.id, {
			label: 'e2e-var-locked',
			stock: 5
		});
		const ownerEmail = `e2e-variant-owner-${Date.now()}@example.test`;

		await occupyEmail(ownerEmail);
		const owner = await requireUser(ownerEmail);
		await linkProductToOrder(owner.id, created.product.id, { variantId: locked.id });

		try {
			await signUpAndVerify(page, account);
			await promoteToAdmin(account.email);

			await test.step('1. La liste des variantes affiche les deux lignes', async () => {
				await page.goto(`/admin/products/${created.product.id}/variants`);
				await waitForPath(page, `/admin/products/${created.product.id}/variants`);
				await expect(page.getByRole('heading', { name: /Variantes/, level: 1 })).toBeVisible();
				await expect(page.getByText(removable.label, { exact: true }).first()).toBeVisible();
				await expect(page.getByText(locked.label, { exact: true }).first()).toBeVisible();
			});

			await test.step('2. Édition du stock', async () => {
				await page.goto(`/admin/products/${created.product.id}/variants/${removable.id}`);
				await page.locator('input[name="stock"]').fill('9');
				await page.getByRole('button', { name: 'Enregistrer' }).click();
				await waitForPath(page, `/admin/products/${created.product.id}/variants`);

				const updated = await getProductVariantById(removable.id);
				expect(updated?.stock).toBe(9);
			});

			await test.step('3. Suppression : la variante libre part, la variante commandée est refusée', async () => {
				await page.goto(`/admin/products/${created.product.id}/variants`);

				const rowRemovable = page
					.locator('tbody tr', { hasText: removable.label })
					.first();
				await rowRemovable.locator('[data-alert-dialog-trigger]').click();
				await expect(page.getByRole('alertdialog')).toBeVisible();
				await Promise.all([
					page.waitForResponse(
						(response) =>
							response.url().includes('deleteVariant') && response.request().method() === 'POST'
					),
					page.getByRole('alertdialog').getByRole('button', { name: 'Continue' }).click()
				]);
				expect(await getProductVariantById(removable.id)).toBeNull();

				const rowLocked = page.locator('tbody tr', { hasText: locked.label }).first();
				await rowLocked.locator('[data-alert-dialog-trigger]').click();
				await expect(page.getByRole('alertdialog')).toBeVisible();
				await Promise.all([
					page.waitForResponse(
						(response) =>
							response.url().includes('deleteVariant') && response.request().method() === 'POST'
					),
					page.getByRole('alertdialog').getByRole('button', { name: 'Continue' }).click()
				]);
				expect(await getProductVariantById(locked.id)).not.toBeNull();
			});
		} finally {
			await deleteProductVariant(removable.id);
			await deleteProductVariant(locked.id);
			await deleteCatalogProduct(created.product.id);
			await deleteUser(ownerEmail);
		}
	});

	test('un CLIENT ne peut pas supprimer une variante', async ({ page, account }) => {
		const created = await createCatalogProduct();
		const variant = await createProductVariant(created.product.id);

		try {
			await signUpAndVerify(page, account);
			const origin = pageOrigin(page);
			await page.request.post(`/admin/products/${created.product.id}/variants?/deleteVariant`, {
				form: { id: variant.id },
				headers: { Origin: origin }
			});
			expect(await getProductVariantById(variant.id)).not.toBeNull();
		} finally {
			await deleteProductVariant(variant.id);
			await deleteCatalogProduct(created.product.id);
		}
	});
});
