import { test, expect } from '../support/fixtures';
import { waitForPath } from '../support/flows';
import { signUpAndVerify } from '../support/admin';
import { productsAdminTable, productAdminRow } from '../support/products';
import {
	createCatalogProduct,
	deleteCatalogProduct,
	deleteUser,
	getProductById,
	linkProductToOrder,
	occupyEmail,
	promoteToAdmin,
	requireUser
} from '../support/db';

/**
 * Actions groupées admin (`Table.svelte` : `selectable`/`bulkActions`) sur
 * `/admin/products` : sélection multi-lignes, suppression en lot, et le
 * produit déjà commandé (FK Restrict) doit être ignoré sans faire échouer
 * les autres suppressions du lot.
 */
test.describe('Administration — suppression groupée des produits', () => {
	test.setTimeout(6 * 60_000);

	test('sélection, suppression en lot, et produit commandé ignoré', async ({ page, account }) => {
		const stamp = Date.now();
		const removableA = await createCatalogProduct({ name: `e2e-bulk-a-${stamp}` });
		const removableB = await createCatalogProduct({ name: `e2e-bulk-b-${stamp}` });
		const locked = await createCatalogProduct({ name: `e2e-bulk-locked-${stamp}` });
		const ownerEmail = `e2e-bulk-owner-${stamp}@example.test`;

		await occupyEmail(ownerEmail);
		const owner = await requireUser(ownerEmail);
		await linkProductToOrder(owner.id, locked.product.id);

		try {
			await signUpAndVerify(page, account);
			await promoteToAdmin(account.email);

			await test.step('1. Sélection de deux produits et suppression en lot', async () => {
				await page.goto('/admin/products');
				await waitForPath(page, '/admin/products');
				await page.getByPlaceholder('Cherchez dans le tableau').first().fill(`e2e-bulk-`);

				const rowA = productAdminRow(page, removableA.product.name);
				const rowB = productAdminRow(page, removableB.product.name);
				await expect(rowA).toBeVisible();
				await expect(rowB).toBeVisible();

				await rowA.getByRole('checkbox').click();
				await rowB.getByRole('checkbox').click();

				await expect(page.getByText('2 éléments sélectionnés')).toBeVisible();

				await page.getByRole('button', { name: 'Supprimer la sélection' }).click();
				await expect(page.getByRole('alertdialog')).toBeVisible();
				await Promise.all([
					page.waitForResponse(
						(response) =>
							response.url().includes('bulkDeleteProducts') &&
							response.request().method() === 'POST'
					),
					page.getByRole('alertdialog').getByRole('button', { name: 'Confirmer' }).click()
				]);

				expect(await getProductById(removableA.product.id)).toBeNull();
				expect(await getProductById(removableB.product.id)).toBeNull();
			});

			await test.step('2. Un produit commandé sélectionné est ignoré, pas d’erreur bloquante', async () => {
				await page.goto('/admin/products');
				await page.getByPlaceholder('Cherchez dans le tableau').first().fill(locked.product.name);

				const rowLocked = productAdminRow(page, locked.product.name);
				await expect(rowLocked).toBeVisible();
				await rowLocked.getByRole('checkbox').click();

				await page.getByRole('button', { name: 'Supprimer la sélection' }).click();
				await expect(page.getByRole('alertdialog')).toBeVisible();
				await Promise.all([
					page.waitForResponse(
						(response) =>
							response.url().includes('bulkDeleteProducts') &&
							response.request().method() === 'POST'
					),
					page.getByRole('alertdialog').getByRole('button', { name: 'Confirmer' }).click()
				]);

				expect(await getProductById(locked.product.id)).not.toBeNull();
			});

			await test.step('3. Sélectionner tout sur la page via la case d’en-tête', async () => {
				await page.goto('/admin/products');
				await waitForPath(page, '/admin/products');
				const headerCheckbox = productsAdminTable(page).locator('thead').getByRole('checkbox');
				await headerCheckbox.click();
				await expect(page.getByText(/éléments? sélectionnés?/)).toBeVisible();
				await headerCheckbox.click();
				await expect(page.getByText(/éléments? sélectionnés?/)).toHaveCount(0);
			});
		} finally {
			await deleteCatalogProduct(removableA.product.id);
			await deleteCatalogProduct(removableB.product.id);
			await deleteCatalogProduct(locked.product.id);
			await deleteUser(ownerEmail);
		}
	});
});
