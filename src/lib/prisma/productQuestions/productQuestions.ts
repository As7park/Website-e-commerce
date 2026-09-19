/**
 * Accès Prisma aux questions produit (Q&A), distinctes des avis (`Review`) :
 * pas de note, réponse écrite par un admin avant toute publication — une
 * question sans réponse n'est jamais retournée par `listPublicQuestionsForProduct`.
 * Activable/désactivable via `StoreSettings.productQnaEnabled`.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '$lib/server';
import { normalizeListParams, type ListParams } from '$lib/prisma/pagination';

const QUESTIONS_PER_PRODUCT = 20;

/** Questions déjà répondues d'un produit — jamais les questions en attente. */
export async function listPublicQuestionsForProduct(productId: string) {
	const questions = await prisma.productQuestion.findMany({
		where: { productId, answer: { not: null } },
		orderBy: { answeredAt: 'desc' },
		take: QUESTIONS_PER_PRODUCT,
		select: { id: true, question: true, answer: true, answeredAt: true }
	});
	return questions;
}

export async function askQuestion(data: { productId: string; userId: string; question: string }) {
	return prisma.productQuestion.create({ data });
}

const ADMIN_QUESTION_SORTABLE = ['createdAt', 'answeredAt'] as const;

/**
 * Liste paginée pour `/admin/products/questions` : recherche sur le nom du
 * produit, l'auteur, ou le texte de la question ; tri sur les dates.
 */
export async function getAllQuestions(params: ListParams = {}) {
	const { page, perPage, skip, search, sort, dir } = normalizeListParams(params, {
		perPage: 20,
		defaultSort: 'createdAt',
		sortable: ADMIN_QUESTION_SORTABLE
	});

	const where: Prisma.ProductQuestionWhereInput = search
		? {
				OR: [
					{ product: { name: { contains: search, mode: 'insensitive' as const } } },
					{ user: { username: { contains: search, mode: 'insensitive' as const } } },
					{ user: { name: { contains: search, mode: 'insensitive' as const } } },
					{ question: { contains: search, mode: 'insensitive' as const } }
				]
			}
		: {};

	const [rows, total] = await Promise.all([
		prisma.productQuestion.findMany({
			where,
			include: {
				product: { select: { name: true, slug: true } },
				user: { select: { username: true, name: true, email: true } }
			},
			orderBy: { [sort]: dir },
			skip,
			take: perPage
		}),
		prisma.productQuestion.count({ where })
	]);

	const items = rows.map((row) => ({
		id: row.id,
		productName: row.product.name,
		productSlug: row.product.slug,
		authorName: row.user.username ?? row.user.name ?? row.user.email,
		question: row.question,
		answer: row.answer,
		createdAt: row.createdAt,
		answeredAt: row.answeredAt
	}));

	return { items, total, page, perPage, search, sort, dir };
}

export async function getQuestionById(id: string) {
	return prisma.productQuestion.findUnique({
		where: { id },
		include: { product: { select: { name: true, slug: true } } }
	});
}

export async function answerQuestion(id: string, answer: string) {
	return prisma.productQuestion.update({
		where: { id },
		data: { answer, answeredAt: new Date() }
	});
}

export async function deleteQuestionById(id: string) {
	return prisma.productQuestion.delete({ where: { id } });
}
