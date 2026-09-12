import type { PageServerLoad } from './$types';
import { listCategories, listProducts } from '$lib/products/catalog';

/**
 * Catalogue public.
 *
 * PRODUCT-PLUGIN : lecture Prisma uniquement. Le filtre `?categorie=` est
 * optionnel. Aucune mutation ici — le CRUD vit sous `/admin/products`.
 */
export const load: PageServerLoad = async ({ url }) => {
	const categoryId = url.searchParams.get('categorie') ?? undefined;
	const page = Number(url.searchParams.get('page')) || 1;
	const [{ products, total, perPage }, categories] = await Promise.all([
		listProducts(categoryId || undefined, page),
		listCategories()
	]);

	return {
		products,
		categories,
		activeCategoryId: categoryId ?? null,
		page,
		perPage,
		total
	};
};
