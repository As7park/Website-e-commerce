// -----------------------------------------------------------------------------
// Lecture publique du catalogue.
//
// Ces fonctions sont le point d'entrée de la vitrine : elles ne servent jamais
// à muter un produit. Les écritures restent dans les DAO Prisma, derrière les
// gardes admin. Retirer le module, pour ce fichier-là, se résume à ne plus
// appeler ces lecteurs depuis les routes `/products`.
// -----------------------------------------------------------------------------

import { prisma } from '$lib/server';
import { cached, getCacheVersion } from '$lib/server/cache';

const publicProductInclude = {
	categories: {
		include: {
			category: true
		}
	}
} as const;

export type PublicProduct = Awaited<ReturnType<typeof listProducts>>['products'][number];

// Lectures publiques fréquentes, écritures rares : mises en cache Redis 60 s
// (TTL court pour limiter le risque de données périmées). Un seul numéro de
// version pour tout le catalogue — bumpé par les DAO d'écriture de
// `$lib/prisma/products` et `$lib/prisma/categories` — invalide en une seule
// opération produits et catégories, sans avoir à énumérer chaque clé filtrée.
const CACHE_NAMESPACE = 'catalog';
const CACHE_TTL_SECONDS = 60;
const PRODUCTS_PER_PAGE = 24;

async function catalogKey(name: string): Promise<string> {
	const version = await getCacheVersion(CACHE_NAMESPACE);
	return `${CACHE_NAMESPACE}:v${version}:${name}`;
}

/**
 * Liste les produits, éventuellement filtrés par catégorie — paginée
 * (`PRODUCTS_PER_PAGE` par page) pour ne jamais charger tout le catalogue en
 * mémoire. La page fait partie de la clé de cache : deux pages différentes
 * ne doivent jamais partager la même entrée.
 */
export async function listProducts(categoryId?: string, page = 1) {
	const safePage = Math.max(1, Math.floor(page));
	const key = await catalogKey(`products:${categoryId ?? 'all'}:page:${safePage}`);
	return cached(key, CACHE_TTL_SECONDS, async () => {
		const where = categoryId
			? {
					categories: {
						some: { categoryId }
					}
				}
			: undefined;

		const [products, total] = await Promise.all([
			prisma.product.findMany({
				where,
				include: publicProductInclude,
				orderBy: { name: 'asc' },
				skip: (safePage - 1) * PRODUCTS_PER_PAGE,
				take: PRODUCTS_PER_PAGE
			}),
			prisma.product.count({ where })
		]);

		return { products, total, page: safePage, perPage: PRODUCTS_PER_PAGE };
	});
}

/** Fiche produit par slug, ou `null` si inconnu. */
export async function getProductBySlug(slug: string) {
	const key = await catalogKey(`product:${slug}`);
	return cached(key, CACHE_TTL_SECONDS, () =>
		prisma.product.findUnique({
			where: { slug },
			include: publicProductInclude
		})
	);
}

/** Catégories du catalogue, pour le filtre de la vitrine. */
export async function listCategories() {
	const key = await catalogKey('categories');
	return cached(key, CACHE_TTL_SECONDS, () =>
		prisma.category.findMany({
			orderBy: { name: 'asc' }
		})
	);
}
