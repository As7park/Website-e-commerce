import type { PageServerLoad } from './$types';
import { getCatalogFacets, listProducts, type ProductSort } from '$lib/products/catalog';
import { getAllTaxonomies } from '$lib/prisma/taxonomies/taxonomies';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';

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
 * PRODUCT-PLUGIN : lecture Prisma uniquement. Chaque taxonomie (« Catégorie »,
 * « Matière », ...) devient un paramètre d'URL (son `slug`), en plus de la
 * recherche, du prix et de la disponibilité. Aucune mutation ici — le CRUD
 * vit sous `/admin/products`.
 */
export const load: PageServerLoad = async ({ url }) => {
	const search = url.searchParams.get('q') ?? undefined;
	const page = Number(url.searchParams.get('page')) || 1;
	const minPrice = parseNumber(url.searchParams.get('prixMin'));
	const maxPrice = parseNumber(url.searchParams.get('prixMax'));
	const inStockOnly = url.searchParams.get('dispo') === '1';
	const sort = parseSort(url.searchParams.get('tri'));

	const taxonomies = await getAllTaxonomies();
	const taxonomyFilters: Record<string, string[]> = {};
	for (const taxonomy of taxonomies) {
		const values = url.searchParams.getAll(taxonomy.slug).filter(Boolean);
		if (values.length > 0) taxonomyFilters[taxonomy.slug] = values;
	}

	const [{ products, total, perPage }, facets, { flashSaleEnabled }] = await Promise.all([
		listProducts({
			page,
			search: search || undefined,
			taxonomyFilters,
			minPrice,
			maxPrice,
			inStockOnly,
			sort
		}),
		getCatalogFacets(taxonomyFilters, search || undefined),
		getStoreFeatureFlags()
	]);

	return {
		products,
		facets,
		search: search ?? '',
		taxonomyFilters,
		minPrice,
		maxPrice,
		inStockOnly,
		sort,
		page,
		perPage,
		total,
		flashSaleEnabled
	};
};
