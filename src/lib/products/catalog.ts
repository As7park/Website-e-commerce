// -----------------------------------------------------------------------------
// Lecture publique du catalogue.
//
// Ces fonctions sont le point d'entrée de la vitrine : elles ne servent jamais
// à muter un produit. Les écritures restent dans les DAO Prisma, derrière les
// gardes admin. Retirer le module, pour ce fichier-là, se résume à ne plus
// appeler ces lecteurs depuis les routes `/products`.
// -----------------------------------------------------------------------------

import type { Prisma } from '@prisma/client';
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

export type ProductSort = 'pertinence' | 'prix-asc' | 'prix-desc' | 'nouveaute';

const SORT_ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput> = {
	pertinence: { name: 'asc' },
	'prix-asc': { price: 'asc' },
	'prix-desc': { price: 'desc' },
	nouveaute: { createdAt: 'desc' }
};

export interface ListProductsOptions {
	categoryId?: string;
	page?: number;
	search?: string;
	/** Facette « Matière » — OR entre les valeurs sélectionnées. */
	materials?: string[];
	minPrice?: number;
	maxPrice?: number;
	inStockOnly?: boolean;
	sort?: ProductSort;
}

function buildWhere({
	categoryId,
	search,
	materials,
	minPrice,
	maxPrice,
	inStockOnly
}: ListProductsOptions): Prisma.ProductWhereInput {
	const normalizedSearch = search?.trim() || undefined;
	const normalizedMaterials = materials?.filter(Boolean);

	return {
		...(categoryId ? { categories: { some: { categoryId } } } : {}),
		...(normalizedSearch
			? {
					OR: [
						{ name: { contains: normalizedSearch, mode: 'insensitive' as const } },
						{ description: { contains: normalizedSearch, mode: 'insensitive' as const } }
					]
				}
			: {}),
		...(normalizedMaterials?.length ? { material: { in: normalizedMaterials } } : {}),
		...(inStockOnly ? { stock: { gt: 0 } } : {}),
		...(minPrice !== undefined || maxPrice !== undefined
			? { price: { ...(minPrice !== undefined ? { gte: minPrice } : {}), ...(maxPrice !== undefined ? { lte: maxPrice } : {}) } }
			: {})
	};
}

/**
 * Liste les produits selon les filtres combinables de la vitrine (catégorie,
 * recherche texte, matière, prix, disponibilité) et un tri — paginée
 * (`PRODUCTS_PER_PAGE` par page) pour ne jamais charger tout le catalogue en
 * mémoire. Chaque paramètre fait partie de la clé de cache : deux résultats
 * différents ne doivent jamais partager la même entrée.
 */
export async function listProducts(options: ListProductsOptions = {}) {
	const safePage = Math.max(1, Math.floor(options.page ?? 1));
	const sort = options.sort ?? 'pertinence';
	const where = buildWhere(options);

	const key = await catalogKey(
		`products:${JSON.stringify({ ...options, page: safePage, sort })}`
	);
	return cached(key, CACHE_TTL_SECONDS, async () => {
		const [products, total] = await Promise.all([
			prisma.product.findMany({
				where,
				include: publicProductInclude,
				orderBy: SORT_ORDER_BY[sort],
				skip: (safePage - 1) * PRODUCTS_PER_PAGE,
				take: PRODUCTS_PER_PAGE
			}),
			prisma.product.count({ where })
		]);

		return { products, total, page: safePage, perPage: PRODUCTS_PER_PAGE };
	});
}

export interface CatalogFacets {
	materials: { value: string; count: number }[];
	priceBounds: { min: number; max: number };
}

/**
 * Options de filtre disponibles pour la catégorie/recherche courantes —
 * matières présentes et bornes de prix. Volontairement calculées sans tenir
 * compte de la matière/du prix déjà sélectionnés (sinon une case cochée
 * ferait disparaître sa propre option) : seuls catégorie et recherche
 * réduisent l'ensemble de départ, comme sur la plupart des vitrines.
 */
export async function getCatalogFacets(categoryId?: string, search?: string): Promise<CatalogFacets> {
	const where = buildWhere({ categoryId, search });
	const key = await catalogKey(`facets:${JSON.stringify({ categoryId, search })}`);

	return cached(key, CACHE_TTL_SECONDS, async () => {
		const [materialGroups, priceAgg] = await Promise.all([
			prisma.product.groupBy({
				by: ['material'],
				where: { ...where, material: { not: null } },
				_count: true
			}),
			prisma.product.aggregate({
				where,
				_min: { price: true },
				_max: { price: true }
			})
		]);

		const materials = materialGroups
			.filter((group) => group.material)
			.map((group) => ({ value: group.material as string, count: group._count }))
			.sort((a, b) => b.count - a.count);

		return {
			materials,
			priceBounds: {
				min: Math.floor(priceAgg._min.price ?? 0),
				max: Math.ceil(priceAgg._max.price ?? 0)
			}
		};
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

const RELATED_PRODUCTS_LIMIT = 4;

/**
 * Produits « vous aimerez aussi » — même(s) catégorie(s), le produit courant
 * exclu. Module activable côté vitrine (`StoreSettings.crossSellEnabled`) ;
 * cette fonction reste appelable indépendamment du flag, la vérification est
 * de la responsabilité de la route.
 */
export async function getRelatedProducts(productId: string, categoryIds: string[]) {
	if (categoryIds.length === 0) return [];

	const key = await catalogKey(`related:${productId}:${categoryIds.slice().sort().join(',')}`);
	return cached(key, CACHE_TTL_SECONDS, () =>
		prisma.product.findMany({
			where: {
				id: { not: productId },
				categories: { some: { categoryId: { in: categoryIds } } }
			},
			include: publicProductInclude,
			orderBy: { createdAt: 'desc' },
			take: RELATED_PRODUCTS_LIMIT
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
