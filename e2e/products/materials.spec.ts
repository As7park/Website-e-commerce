import { test, expect } from '../support/fixtures';
import { waitForPath } from '../support/flows';
import { pageOrigin, signUpAndVerify } from '../support/admin';
import { materialAdminRow } from '../support/products';
import {
	createCatalogProduct,
	deleteCatalogProduct,
	deleteMaterial,
	getMaterialById,
	getMaterialByName,
	getProductById,
	promoteToAdmin
} from '../support/db';

/**
 * Taxonomie « Matière » : CRUD admin, association à un produit, filtre
 * catalogue et suppression non bloquante (`onDelete: SetNull`).
 */
test.describe('Administration — matières', () => {
	test.setTimeout(6 * 60_000);

	test('création, association, filtre, renommage et suppression', async ({ page, account }) => {
		const created = await createCatalogProduct();
		const materialName = `e2e-material-${Date.now()}`;
		const renamedName = `${materialName}-renomme`;
		let materialId: string | null = null;

		try {
			await signUpAndVerify(page, account);
			await promoteToAdmin(account.email);

			await test.step('1. Création depuis /admin/products/materials/create', async () => {
				await page.goto('/admin/products/materials/create');
				await page.locator('input[name="name"]').fill(materialName);
				await page.getByRole('button', { name: 'Save changes' }).click();
				await waitForPath(page, '/admin/products');
				await expect(materialAdminRow(page, materialName)).toBeVisible();

				const material = await getMaterialByName(materialName);
				expect(material).not.toBeNull();
				materialId = material!.id;
			});

			await test.step('2. Association à un produit depuis la fiche admin', async () => {
				await page.goto(`/admin/products/${created.product.id}`);
				// bits-ui `Select.Trigger` rend un `<button>` simple (libellé
				// courant, "Aucune" par défaut), pas un `role="combobox"`.
				await page.getByRole('button', { name: 'Aucune' }).click();
				await page.getByText(materialName, { exact: true }).click();
				// Le trigger affiche le nom choisi dès que la sélection est prise en
				// compte : l'attendre avant Save changes évite une course avec l'effet
				// Svelte qui recopie la valeur dans les données du formulaire.
				await expect(page.getByRole('button', { name: materialName })).toBeVisible();
				// La sauvegarde ne redirige pas et n'affiche aucun message : on
				// attend la réponse de l'action plutôt qu'une navigation.
				await Promise.all([
					page.waitForResponse(
						(response) =>
							response.url().includes('?/updateProduct') && response.request().method() === 'POST'
					),
					page.getByRole('button', { name: 'Save changes' }).click()
				]);

				const updated = await getProductById(created.product.id);
				expect(updated?.materialId).toBe(materialId);

				await page.goto(`/products/${created.product.slug}`);
				await expect(page.getByText(materialName, { exact: true })).toBeVisible();
			});

			await test.step('3. Filtre catalogue par matière', async () => {
				// Le facet filtre par nom de matière (lisible dans l'URL), pas par id
				// — voir `getCatalogFacets`/`listProducts` dans `$lib/products/catalog.ts`.
				await page.goto(`/products?materiau=${encodeURIComponent(materialName)}`);
				await expect(page.getByRole('heading', { name: created.product.name })).toBeVisible();

				await page.goto('/products?materiau=placeholder-inexistant');
				await expect(page.getByRole('heading', { name: created.product.name })).not.toBeVisible();
			});

			await test.step('4. Renommage', async () => {
				await page.goto('/admin/products');
				await materialAdminRow(page, materialName).getByRole('link', { name: 'edit' }).click();
				await waitForPath(page, `/admin/products/materials/${materialId}`);
				await page.locator('input[name="name"]').fill(renamedName);
				await page.getByRole('button', { name: 'Save changes' }).click();
				await waitForPath(page, '/admin/products');
				await expect(materialAdminRow(page, renamedName)).toBeVisible();
				expect((await getMaterialById(materialId!))?.name).toBe(renamedName);
			});

			await test.step('5. Suppression : ne bloque pas, le produit perd juste sa matière', async () => {
				await materialAdminRow(page, renamedName).locator('[data-alert-dialog-trigger]').click();
				await expect(page.getByRole('alertdialog')).toBeVisible();
				await Promise.all([
					page.waitForResponse(
						(response) =>
							response.url().includes('deleteMaterial') && response.request().method() === 'POST'
					),
					page.getByRole('alertdialog').getByRole('button', { name: 'Continue' }).click()
				]);

				expect(await getMaterialById(materialId!)).toBeNull();
				const productAfterDelete = await getProductById(created.product.id);
				expect(productAfterDelete?.materialId).toBeNull();
				materialId = null;
			});
		} finally {
			await deleteCatalogProduct(created.product.id);
			if (materialId) await deleteMaterial(materialId);
		}
	});

	test('un CLIENT ne peut pas créer de matière', async ({ page, account }) => {
		const materialName = `e2e-material-client-${Date.now()}`;

		await signUpAndVerify(page, account);
		const origin = pageOrigin(page);
		await page.request.post('/admin/products/materials/create?/createMaterial', {
			form: { name: materialName },
			headers: { Origin: origin }
		});
		expect(await getMaterialByName(materialName)).toBeNull();
	});
});
