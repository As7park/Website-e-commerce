import type { PageServerLoad } from './$types';
import { getTaxonomyBySlug } from '$lib/prisma/taxonomies/taxonomies';
import { listProducts } from '$lib/products/catalog';

/**
 * Accueil boutique.
 *
 * PRODUCT-PLUGIN : « Catégories » lit la taxonomie `categorie` (système
 * générique, voir `docs/products/README.md`) plutôt que l'ancien modèle
 * `Category` — reste vide tant que cette taxonomie n'a pas été créée en
 * admin (`/admin/products/taxonomies`), pas une erreur. « Nouveautés »
 * réutilise `listProducts` (tri `nouveaute`), la même lecture publique que
 * `/products`, plutôt qu'une requête Prisma dédiée.
 */
export const load: PageServerLoad = async () => {
	const [categoryTaxonomy, { products: latestProducts }] = await Promise.all([
		getTaxonomyBySlug('categorie'),
		listProducts({ sort: 'nouveaute' })
	]);

	return {
		categories: (categoryTaxonomy?.values ?? []).slice(0, 4).map((value) => ({
			id: value.id,
			name: value.label || value.value,
			value: value.value
		})),
		categoryFilterSlug: categoryTaxonomy?.slug ?? 'categorie',
		featuredProducts: latestProducts.slice(0, 4)
	};
};
