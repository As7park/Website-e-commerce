import type { PageServerLoad } from './$types';
import { getTaxonomyBySlug } from '$lib/prisma/taxonomies/taxonomies';
import { listProducts } from '$lib/products/catalog';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';

/**
 * Accueil boutique.
 *
 * PRODUCT-PLUGIN : « Catégories » lit la taxonomie `categorie` (système
 * générique, voir `docs/products/README.md`) plutôt que l'ancien modèle
 * `Category` — reste vide tant que cette taxonomie n'a pas été créée en
 * admin (`/admin/products/taxonomies`), pas une erreur. « Nouveautés »
 * (hero + runner) et « Sélection du moment » (galerie horizontale)
 * réutilisent `listProducts`, la même lecture publique que `/products`,
 * plutôt qu'une requête Prisma dédiée.
 */
export const load: PageServerLoad = async () => {
	const [categoryTaxonomy, latest, selection, { flashSaleEnabled }] = await Promise.all([
		getTaxonomyBySlug('categorie'),
		listProducts({ sort: 'nouveaute' }),
		listProducts({ sort: 'pertinence' }),
		getStoreFeatureFlags()
	]);
	const categoryValues = categoryTaxonomy?.values ?? [];

	return {
		categories: categoryValues.slice(0, 4).map((value) => ({
			id: value.id,
			name: value.label || value.value,
			value: value.value
		})),
		categoryFilterSlug: categoryTaxonomy?.slug ?? 'categorie',
		featuredProducts: latest.products.slice(0, 6),
		selectionProducts: selection.products.slice(0, 8),
		stats: { products: latest.total, categories: categoryValues.length },
		flashSaleEnabled
	};
};
