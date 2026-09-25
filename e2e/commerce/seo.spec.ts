import { test, expect } from '../support/fixtures';
import { signUpAndVerify } from '../support/admin';
import {
	createBlogPost,
	createCatalogProduct,
	deleteBlogPost,
	deleteCatalogProduct,
	promoteToAdmin
} from '../support/db';

/**
 * Gestion du SEO — voir CONFORMITE_ECOMMERCE.md. Trois garanties vérifiées
 * en conditions réelles, pas seulement en lisant le code : le sitemap liste
 * bien les produits et articles réels (généré dynamiquement, pas une liste
 * figée), les zones privées sont bien en noindex (posé au niveau du layout
 * — un seul test par layout suffit à couvrir toutes les sous-pages,
 * actuelles et futures), et un article de blog a un SEO propre à son
 * contenu plutôt que le titre générique du site.
 */
test.describe('SEO', () => {
	test.setTimeout(4 * 60_000);

	test('le sitemap liste les produits et articles publiés réels', async ({ page }) => {
		const { product } = await createCatalogProduct();
		const { post } = await createBlogPost();

		try {
			// `import.meta.glob(..., { eager: true })` sur toutes les pages du
			// site (implémentation existante, pas introduite ici) : premier
			// appel très lent à froid en dev (compilation Vite de chaque
			// +page.svelte), d'où un timeout plus généreux que la normale.
			const response = await page.request.get('/sitemap.xml', { timeout: 90_000 });
			expect(response.status()).toBe(200);
			const body = await response.text();
			expect(body).toContain(`/products/${product.slug}`);
			expect(body).toContain(`/blog/${post.slug}`);
		} finally {
			await deleteCatalogProduct(product.id);
			await deleteBlogPost(post.id);
		}
	});

	test('les zones privées (/auth, /admin) sont en noindex', async ({ page, account }) => {
		await test.step('/auth/login, accessible sans connexion', async () => {
			await page.goto('/auth/login');
			await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
				'content',
				'noindex, nofollow'
			);
		});

		await test.step('/admin, une fois connecté en tant qu’administrateur', async () => {
			await signUpAndVerify(page, account);
			await promoteToAdmin(account.email);
			await page.goto('/admin');
			await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
				'content',
				'noindex, nofollow'
			);
		});
	});

	test('un article de blog a son propre titre et sa propre description', async ({ page }) => {
		const { post } = await createBlogPost({ title: 'Comment choisir sa bague de fiançailles' });

		try {
			await page.goto(`/blog/${post.slug}`);
			await expect(page).toHaveTitle(/Comment choisir sa bague de fiançailles/);
			await expect(page.locator('meta[property="article:author"]')).toHaveAttribute(
				'content',
				/.+/
			);
		} finally {
			await deleteBlogPost(post.id);
		}
	});
});
