import { prisma } from '$lib/server';
import { bumpCacheVersion } from '$lib/server/cache';
import { reportIfRepeated } from '$lib/server/alerting';
import { normalizeListParams, type ListParams } from '$lib/prisma/pagination';

const PRODUCT_SORTABLE = ['name', 'price', 'stock', 'createdAt'] as const;

/**
 * Seuil de rupture imminente. Le stock n'est aujourd'hui décrémenté par
 * aucune vente (le catalogue ne fait que l'afficher) — ce signal se
 * déclenche donc à chaque sauvegarde admin d'un produit sous le seuil, pas
 * en continu : `reportIfRepeated` (déjà utilisé pour les 5xx et la
 * contention de verrous) borne à une alerte par produit et par jour.
 */
export const LOW_STOCK_THRESHOLD = 5;
const LOW_STOCK_WINDOW_SECONDS = 24 * 60 * 60;

async function checkLowStockAlert(product: { id: string; name: string; stock: number }) {
	if (product.stock < 0 || product.stock > LOW_STOCK_THRESHOLD) return;
	await reportIfRepeated(`low-stock:${product.id}`, {
		threshold: 1,
		windowSeconds: LOW_STOCK_WINDOW_SECONDS,
		message: `Stock bas : "${product.name}" (${product.stock} unité${product.stock > 1 ? 's' : ''} restante${product.stock > 1 ? 's' : ''})`
	});
}

/// Legacy `categories`/`material` gardés le temps de la bascule vers les
/// taxonomies génériques (retirés en migration B, voir docs/products/README.md).
const taxonomyValuesInclude = {
	taxonomyValues: { include: { taxonomyValue: { include: { taxonomy: true } } } }
} as const;

/**
 * Accès Prisma aux produits.
 *
 * PRODUCT-PLUGIN : ces fonctions alimentent la vitrine (`src/lib/products`) et
 * le CRUD admin. COMMERCE-PLUGIN : le prix catalogue est relui à l'écriture
 * du panier (`updateOrderItems`).
 *
 * `bumpCacheVersion('catalog')` invalide le cache de lecture publique
 * (`$lib/products/catalog`) après chaque écriture — voir `src/lib/server/cache.ts`.
 */

/** Un produit déjà commandé ne peut pas être effacé : l'historique de vente reste. */
export class ProductInUseError extends Error {
	constructor(public readonly productId: string) {
		super('Ce produit est lié à des commandes et ne peut pas être supprimé.');
		this.name = 'ProductInUseError';
	}
}

export const createProduct = async (productData: {
	name: string;
	description: string;
	price: number;
	stock: number;
	images: string[];
	slug: string;
	colorProduct: string;
	sku?: string | null;
	materialId?: string | null;
	compareAtPrice?: number | null;
	flashSaleEndsAt?: string | null;
	weight?: number | null;
	length?: number | null;
	width?: number | null;
	height?: number | null;
}) => {
	const { flashSaleEndsAt, ...rest } = productData;
	const product = await prisma.product.create({
		data: { ...rest, flashSaleEndsAt: flashSaleEndsAt ? new Date(flashSaleEndsAt) : null }
	});
	await bumpCacheVersion('catalog');
	await checkLowStockAlert(product);
	return product;
};

export const getProductById = async (productId: string) => {
	return await prisma.product.findUnique({
		where: { id: productId },
		include: { categories: true, material: true, ...taxonomyValuesInclude }
	});
};

export const getProductBySlug = async (slug: string) => {
	return prisma.product.findUnique({
		where: { slug },
		include: {
			categories: {
				include: { category: true }
			},
			material: true,
			...taxonomyValuesInclude
		}
	});
};

export const deleteProductById = async (productId: string) => {
	const linkedItems = await prisma.orderItem.count({
		where: { productId }
	});
	if (linkedItems > 0) {
		throw new ProductInUseError(productId);
	}

	await prisma.productCategory.deleteMany({
		where: { productId }
	});

	const deleted = await prisma.product.delete({
		where: { id: productId }
	});
	await bumpCacheVersion('catalog');
	return deleted;
};

export const deleteProductTaxonomyValues = async (productId: string) => {
	const result = await prisma.productTaxonomyValue.deleteMany({ where: { productId } });
	await bumpCacheVersion('catalog');
	return result;
};

export const connectProductToTaxonomyValues = async (
	productId: string,
	taxonomyValueIds: string[]
) => {
	if (taxonomyValueIds.length === 0) return { count: 0 };
	const result = await prisma.productTaxonomyValue.createMany({
		data: taxonomyValueIds.map((taxonomyValueId) => ({ productId, taxonomyValueId }))
	});
	await bumpCacheVersion('catalog');
	return result;
};

/**
 * Liste paginée pour `/admin/products` : recherche sur nom/description, tri
 * sur nom/prix/stock/date de création. `getProductBySlug`/`getProductById`
 * restent des lectures unitaires, non concernées.
 */
export const getAllProducts = async (params: ListParams = {}) => {
	const { page, perPage, skip, search, sort, dir } = normalizeListParams(params, {
		perPage: 20,
		defaultSort: 'name',
		sortable: PRODUCT_SORTABLE
	});

	const where = search
		? {
				OR: [
					{ name: { contains: search, mode: 'insensitive' as const } },
					{ description: { contains: search, mode: 'insensitive' as const } }
				]
			}
		: undefined;

	try {
		const [items, total] = await Promise.all([
			prisma.product.findMany({
				where,
				include: {
					categories: {
						include: {
							category: true
						}
					},
					material: true,
					...taxonomyValuesInclude
				},
				orderBy: { [sort]: dir },
				skip,
				take: perPage
			}),
			prisma.product.count({ where })
		]);
		return { items, total, page, perPage, search, sort, dir };
	} catch (error) {
		console.error('Error fetching products:', error);
		throw new Error('Could not fetch products');
	}
};

export const updateProductById = async (
	productId: string,
	data: {
		name?: string;
		description?: string;
		price?: number;
		stock?: number;
		images?: string[];
		colorProduct?: string;
		sku?: string | null;
		materialId?: string | null;
		compareAtPrice?: number | null;
		flashSaleEndsAt?: string | null;
		weight?: number | null;
		length?: number | null;
		width?: number | null;
		height?: number | null;
	}
) => {
	const { flashSaleEndsAt, ...rest } = data;
	const product = await prisma.product.update({
		where: { id: productId },
		data: {
			...rest,
			...(flashSaleEndsAt !== undefined
				? { flashSaleEndsAt: flashSaleEndsAt ? new Date(flashSaleEndsAt) : null }
				: {})
		}
	});
	await bumpCacheVersion('catalog');
	await checkLowStockAlert(product);
	return product;
};
