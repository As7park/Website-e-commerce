import { prisma } from '$lib/server';
import { bumpCacheVersion } from '$lib/server/cache';
import { normalizeListParams, type ListParams } from '$lib/prisma/pagination';

const PRODUCT_SORTABLE = ['name', 'price', 'stock', 'createdAt'] as const;

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
	material?: string | null;
	compareAtPrice?: number | null;
}) => {
	const product = await prisma.product.create({
		data: productData
	});
	await bumpCacheVersion('catalog');
	return product;
};

export const getProductById = async (productId: string) => {
	return await prisma.product.findUnique({
		where: { id: productId },
		include: { categories: true }
	});
};

export const getProductBySlug = async (slug: string) => {
	return prisma.product.findUnique({
		where: { slug },
		include: {
			categories: {
				include: { category: true }
			}
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

export const connectProductToCategories = async (productId: string, categoryIds: string[]) => {
	const result = await prisma.productCategory.createMany({
		data: categoryIds.map((categoryId) => ({
			productId,
			categoryId
		}))
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
					}
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
		material?: string | null;
		compareAtPrice?: number | null;
	}
) => {
	const product = await prisma.product.update({
		where: { id: productId },
		data
	});
	await bumpCacheVersion('catalog');
	return product;
};
