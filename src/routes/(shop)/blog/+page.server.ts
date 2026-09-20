import type { PageServerLoad } from './$types';
import { listBlogCategories, listBlogTags, listPublishedPosts } from '$lib/blog/catalog';

/**
 * Vitrine publique du blog.
 *
 * BLOG-PLUGIN : lecture Prisma des articles `published` uniquement. Les
 * filtres `?categorie=`, `?tag=`, `?q=` et `?page=` sont optionnels et
 * combinables. Aucune mutation ici — le CRUD vit sous `/admin/blog`.
 */
export const load: PageServerLoad = async ({ url }) => {
	const categoryId = url.searchParams.get('categorie') || undefined;
	const tagId = url.searchParams.get('tag') || undefined;
	const search = url.searchParams.get('q') || undefined;
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const [{ posts, total, perPage }, categories, tags] = await Promise.all([
		listPublishedPosts({ categoryValueId: categoryId, tagValueId: tagId, search, page }),
		listBlogCategories(),
		listBlogTags()
	]);

	return {
		posts,
		categories,
		tags,
		total,
		page,
		perPage,
		search: search ?? '',
		activeCategoryId: categoryId ?? null,
		activeTagId: tagId ?? null
	};
};
