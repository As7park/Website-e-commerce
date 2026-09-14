/**
 * Accès Prisma aux avis produit.
 *
 * PRODUCT-PLUGIN : un avis par compte et par produit — la contrainte unique
 * (`@@unique([productId, userId])`) est la garde réelle, pas seulement l'UI
 * qui masque le formulaire une fois l'avis posé.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '$lib/server';
import { normalizeListParams, type ListParams } from '$lib/prisma/pagination';

export class AlreadyReviewedError extends Error {
	constructor() {
		super('Vous avez déjà noté ce produit.');
		this.name = 'AlreadyReviewedError';
	}
}

export interface ReviewSummary {
	average: number;
	count: number;
}

/** Moyenne et nombre d'avis d'un produit — `average` à 0 si aucun avis. */
export async function getReviewSummary(productId: string): Promise<ReviewSummary> {
	const result = await prisma.review.aggregate({
		where: { productId },
		_avg: { rating: true },
		_count: true
	});
	return { average: result._avg.rating ?? 0, count: result._count };
}

const REVIEWS_PER_PRODUCT = 20;

/** Derniers avis d'un produit, avec l'identité publique de l'auteur. */
export async function listReviewsForProduct(productId: string) {
	const reviews = await prisma.review.findMany({
		where: { productId },
		include: { user: { select: { username: true, name: true } } },
		orderBy: { createdAt: 'desc' },
		take: REVIEWS_PER_PRODUCT
	});

	return reviews.map((review) => ({
		id: review.id,
		rating: review.rating,
		comment: review.comment,
		createdAt: review.createdAt,
		authorName: review.user.username ?? review.user.name ?? 'Client'
	}));
}

/** L'avis déjà posé par ce compte sur ce produit, ou `null`. */
export async function getUserReviewForProduct(productId: string, userId: string) {
	return prisma.review.findUnique({
		where: { productId_userId: { productId, userId } }
	});
}

const ADMIN_REVIEW_SORTABLE = ['rating', 'createdAt'] as const;

/**
 * Liste paginée pour `/admin/products/reviews` : modération — recherche sur
 * le nom du produit ou le pseudo/nom de l'auteur, tri sur la note ou la date.
 */
export async function getAllReviews(params: ListParams = {}) {
	const { page, perPage, skip, search, sort, dir } = normalizeListParams(params, {
		perPage: 20,
		defaultSort: 'createdAt',
		sortable: ADMIN_REVIEW_SORTABLE
	});

	const where: Prisma.ReviewWhereInput = search
		? {
				OR: [
					{ product: { name: { contains: search, mode: 'insensitive' as const } } },
					{ user: { username: { contains: search, mode: 'insensitive' as const } } },
					{ user: { name: { contains: search, mode: 'insensitive' as const } } }
				]
			}
		: {};

	const [rows, total] = await Promise.all([
		prisma.review.findMany({
			where,
			include: {
				product: { select: { name: true, slug: true } },
				user: { select: { username: true, name: true, email: true } }
			},
			orderBy: { [sort]: dir },
			skip,
			take: perPage
		}),
		prisma.review.count({ where })
	]);

	const items = rows.map((review) => ({
		id: review.id,
		productName: review.product.name,
		productSlug: review.product.slug,
		authorName: review.user.username ?? review.user.name ?? review.user.email,
		rating: review.rating,
		comment: review.comment,
		createdAt: review.createdAt
	}));

	return { items, total, page, perPage, search, sort, dir };
}

export async function deleteReviewById(id: string) {
	return prisma.review.delete({ where: { id } });
}

export async function createReview(data: {
	productId: string;
	userId: string;
	rating: number;
	comment: string | null;
}) {
	try {
		return await prisma.review.create({ data });
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			throw new AlreadyReviewedError();
		}
		throw error;
	}
}
