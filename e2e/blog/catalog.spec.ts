import { test, expect } from '../support/fixtures';
import { waitForPath } from '../support/flows';
import { createBlogPost, deleteBlogPost, getBlogPostBySlug } from '../support/db';

/**
 * Vitrine publique Prisma : liste, fiche, 404, brouillon. Pas de formulaires admin.
 */
test.describe('Blog — vitrine', () => {
	test('liste, fiche, slug inconnu et brouillon', async ({ page }) => {
		const published = await createBlogPost({ published: true });
		const draft = await createBlogPost({ published: false });

		try {
			await test.step('1. La liste affiche le titre Prisma', async () => {
				await page.goto('/blog');
				await waitForPath(page, '/blog');
				await expect(page.getByRole('heading', { name: 'Blog' })).toBeVisible();
				await expect(page.getByRole('heading', { name: published.post.title })).toBeVisible();
				await expect(
					page
						.getByRole('navigation', { name: 'Filtrer par catégorie' })
						.getByRole('link', { name: published.category.name, exact: true })
				).toBeVisible();
			});

			await test.step('2. La fiche s’ouvre par slug', async () => {
				await page.goto(`/blog/${published.post.slug}`);
				await waitForPath(page, `/blog/${published.post.slug}`);
				await expect(page.getByRole('heading', { name: published.post.title })).toBeVisible();
				await expect(page.getByText(published.author.name)).toBeVisible();
				expect(await getBlogPostBySlug(published.post.slug)).not.toBeNull();
			});

			await test.step('3. Un slug inconnu renvoie 404', async () => {
				const response = await page.goto('/blog/e2e-slug-inconnu-absent');
				expect(response?.status()).toBe(404);
			});

			await test.step('4. Un brouillon n’est pas public', async () => {
				const response = await page.goto(`/blog/${draft.post.slug}`);
				expect(response?.status()).toBe(404);
				await page.goto('/blog');
				await expect(page.getByRole('heading', { name: draft.post.title })).toHaveCount(0);
			});

			await test.step('5. Pas d’UI d’édition admin sur la vitrine', async () => {
				await page.goto('/blog');
				const html = await page.content();
				expect(html).not.toContain('/admin/blog');
				expect(html).not.toContain('passwordHash');
			});
		} finally {
			await deleteBlogPost(published.post.id);
			await deleteBlogPost(draft.post.id);
		}
	});

	test('recherche, filtre par tag et articles liés', async ({ page }) => {
		const withTag = await createBlogPost({ published: true, tagValue: `e2e-tag-${Date.now()}` });
		const sameCategory = await createBlogPost({
			published: true,
			categoryValueId: withTag.category.id
		});

		try {
			await test.step('6. La recherche filtre par titre', async () => {
				await page.goto(`/blog?q=${encodeURIComponent(withTag.post.title)}`);
				await expect(page.getByRole('heading', { name: withTag.post.title })).toBeVisible();
				await expect(page.getByRole('heading', { name: sameCategory.post.title })).toHaveCount(0);
			});

			await test.step('7. Une recherche sans résultat affiche un état vide', async () => {
				await page.goto('/blog?q=e2e-terme-introuvable-xyz');
				await expect(page.getByText(/Aucun article ne correspond/)).toBeVisible();
			});

			await test.step('8. Le filtre par tag ne montre que l’article associé', async () => {
				await page.goto(`/blog?tag=${withTag.tag!.id}`);
				await expect(page.getByRole('heading', { name: withTag.post.title })).toBeVisible();
				await expect(page.getByRole('heading', { name: sameCategory.post.title })).toHaveCount(0);
			});

			await test.step('9. La fiche affiche le temps de lecture et les articles liés', async () => {
				await page.goto(`/blog/${withTag.post.slug}`);
				await expect(page.getByText(/min de lecture/)).toBeVisible();
				await expect(page.getByRole('heading', { name: 'À lire aussi' })).toBeVisible();
				await expect(page.getByRole('link', { name: sameCategory.post.title })).toBeVisible();
			});
		} finally {
			await deleteBlogPost(withTag.post.id);
			await deleteBlogPost(sameCategory.post.id);
		}
	});
});
