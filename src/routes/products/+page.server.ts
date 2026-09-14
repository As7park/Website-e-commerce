import type { PageServerLoad } from './$types';
import {
	getCatalogFacets,
	listCategories,
	listProducts,
	type ProductSort
} from '$lib/products/catalog';

const SORTS: ProductSort[] = ['pertinence', 'prix-asc', 'prix-desc', 'nouveaute'];

function parseSort(raw: string | null): ProductSort {
	return SORTS.includes(raw as ProductSort) ? (raw as ProductSort) : 'pertinence';
}

function parseNumber(raw: string | null): number | undefined {
	if (!raw) return undefined;
	const value = Number(raw);
	return Number.isFinite(value) ? value : undefined;
}

/**
 * Catalogue public.
 *
 * PRODUCT-PLUGIN : lecture Prisma uniquement. Filtres combinables (catégorie,
 * recherche, matière, prix, disponibilité) et tri, tous optionnels. Aucune
 * mutation ici — le CRUD vit sous `/admin/products`.
 */
export const load: PageServerLoad = async ({ url }) => {
	const categoryId = url.searchParams.get('categorie') ?? undefined;
	const search = url.searchParams.get('q') ?? undefined;
	const page = Number(url.searchParams.get('page')) || 1;
	const materials = url.searchParams.getAll('materiau').filter(Boolean);
	const minPrice = parseNumber(url.searchParams.get('prixMin'));
	const maxPrice = parseNumber(url.searchParams.get('prixMax'));
	const inStockOnly = url.searchParams.get('dispo') === '1';
	const sort = parseSort(url.searchParams.get('tri'));

	const [{ products, total, perPage }, categories, facets] = await Promise.all([
		listProducts({
			categoryId: categoryId || undefined,
			page,
			search: search || undefined,
			materials,
			minPrice,
			maxPrice,
			inStockOnly,
			sort
		}),
		listCategories(),
		getCatalogFacets(categoryId || undefined, search || undefined)
	]);

	return {
		products,
		categories,
		facets,
		activeCategoryId: categoryId ?? null,
		search: search ?? '',
		materials,
		minPrice,
		maxPrice,
		inStockOnly,
		sort,
		page,
		perPage,
		total
	};
};
