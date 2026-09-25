import type { PageServerLoad } from './$types';
import { getCatalogFacets, listProducts, type ProductSort } from '$lib/products/catalog';
import { getAllTaxonomies } from '$lib/prisma/taxonomies/taxonomies';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';
import { getVatRate } from '$lib/server/vat';
import { toTTC } from '$lib/utils/price';

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
	// Le filtre prix reçu de l'UI est en TTC (ce que le client voit et saisit) —
	// converti en HT ici puisque `Product.price` est stocké HT (voir toTTC).
	const minPriceTTC = parseNumber(url.searchParams.get('prixMin'));
	const maxPriceTTC = parseNumber(url.searchParams.get('prixMax'));
	const inStockOnly = url.searchParams.get('dispo') === '1';
	const sort = parseSort(url.searchParams.get('tri'));

	const vatRate = await getVatRate();
	const minPrice = minPriceTTC !== undefined ? minPriceTTC / (1 + vatRate) : undefined;
	const maxPrice = maxPriceTTC !== undefined ? maxPriceTTC / (1 + vatRate) : undefined;

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
		facets: {
			...facets,
			priceBounds: {
				min: toTTC(facets.priceBounds.min, vatRate),
				max: toTTC(facets.priceBounds.max, vatRate)
			}
		},
		search: search ?? '',
		taxonomyFilters,
		minPrice: minPriceTTC,
		maxPrice: maxPriceTTC,
		inStockOnly,
		sort,
		page,
		perPage,
		total,
		flashSaleEnabled,
		vatRate
	};
};
