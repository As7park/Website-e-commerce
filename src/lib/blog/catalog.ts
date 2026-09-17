// -----------------------------------------------------------------------------
// Lecture publique du blog.
//
// Point d'entrée de la vitrine : uniquement les articles `published`. Les
// brouillons restent dans le CRUD admin. Retirer le module, pour ce fichier,
// se résume à ne plus appeler ces lecteurs depuis les routes `/blog`.
// BLOG-PLUGIN
// -----------------------------------------------------------------------------

import type { Prisma } from '@prisma/client';
import { prisma } from '$lib/server';

// La vitrine suppose une taxonomie "catégorie" (nav de filtre, une par
// article) et une taxonomie "tag" (affichage libre, plusieurs par article) —
// créées par le backfill de la migration `20260917270000_add_blog_taxonomies`.
// Toute autre taxonomie créée en admin n'apparaît pas ici (pas de nav dédiée).
const CATEGORY_TAXONOMY_SLUG = 'categorie';
const TAG_TAXONOMY_SLUG = 'tag';

const POSTS_PER_PAGE = 9;
const RELATED_POSTS_LIMIT = 3;

const publicPostTaxonomySelect = {
	taxonomyValues: {
		select: {
			taxonomyValue: {
				select: { id: true, value: true, label: true, taxonomy: { select: { slug: true } } }
			}
		}
	}
} as const;

type PostWithTaxonomyValues = {
	taxonomyValues: {
		taxonomyValue: { id: string; value: string; label: string | null; taxonomy: { slug: string } };
	}[];
};

/** Dérive `category`/`tags` (shape attendue par la vitrine) des valeurs de taxonomie assignées. */
function toPublicPost<T extends PostWithTaxonomyValues>(post: T) {
	const categoryValue = post.taxonomyValues.find(
		({ taxonomyValue }) => taxonomyValue.taxonomy.slug === CATEGORY_TAXONOMY_SLUG
	)?.taxonomyValue;
	const tags = post.taxonomyValues
		.filter(({ taxonomyValue }) => taxonomyValue.taxonomy.slug === TAG_TAXONOMY_SLUG)
		.map(({ taxonomyValue }) => ({
			tag: { id: taxonomyValue.id, name: taxonomyValue.label || taxonomyValue.value }
		}));

	return {
		...post,
		category: categoryValue
			? { id: categoryValue.id, name: categoryValue.label || categoryValue.value }
			: null,
		tags
	};
}

export type PublicPost = Awaited<ReturnType<typeof listPublishedPosts>>['posts'][number];

export interface ListPublishedPostsOptions {
	categoryValueId?: string;
	tagValueId?: string;
	search?: string;
	page?: number;
}

function buildPublishedPostsWhere({
	categoryValueId,
	tagValueId,
	search
}: ListPublishedPostsOptions): Prisma.BlogPostWhereInput {
	const normalizedSearch = search?.trim() || undefined;
	const taxonomyConditions: Prisma.BlogPostWhereInput[] = [];
	if (categoryValueId) {
		taxonomyConditions.push({ taxonomyValues: { some: { taxonomyValueId: categoryValueId } } });
	}
	if (tagValueId) {
		taxonomyConditions.push({ taxonomyValues: { some: { taxonomyValueId: tagValueId } } });
	}

	return {
		published: true,
		...(normalizedSearch ? { title: { contains: normalizedSearch, mode: 'insensitive' } } : {}),
		...(taxonomyConditions.length > 0 ? { AND: taxonomyConditions } : {})
	};
}

/**
 * Articles publiés, paginés (`POSTS_PER_PAGE`), filtrables par valeur de
 * catégorie, valeur de tag et recherche (titre). `content` n'est pas chargé
 * (non affiché en liste).
 */
export async function listPublishedPosts(options: ListPublishedPostsOptions = {}) {
	const page = Math.max(1, options.page ?? 1);
	const where = buildPublishedPostsWhere(options);

	const [total, posts] = await Promise.all([
		prisma.blogPost.count({ where }),
		prisma.blogPost.findMany({
			where,
			select: {
				id: true,
				title: true,
				slug: true,
				createdAt: true,
				author: { select: { name: true } },
				...publicPostTaxonomySelect
			},
			orderBy: { createdAt: 'desc' },
			skip: (page - 1) * POSTS_PER_PAGE,
			take: POSTS_PER_PAGE
		})
	]);

	return { posts: posts.map(toPublicPost), total, page, perPage: POSTS_PER_PAGE };
}

/** Fiche publique par slug, ou `null` si inconnu / non publié. */
export async function getPublishedPostBySlug(slug: string) {
	const post = await prisma.blogPost.findFirst({
		where: { slug, published: true },
		select: {
			id: true,
			title: true,
			slug: true,
			content: true,
			createdAt: true,
			author: { select: { name: true } },
			...publicPostTaxonomySelect
		}
	});
	return post ? toPublicPost(post) : null;
}

/**
 * Articles « à lire aussi » — même valeur de catégorie, l'article courant
 * exclu. Retourne `[]` sans catégorie (pas de base de comparaison).
 */
export async function getRelatedPosts(postId: string, categoryValueId?: string) {
	if (!categoryValueId) return [];

	const posts = await prisma.blogPost.findMany({
		where: {
			published: true,
			id: { not: postId },
			taxonomyValues: { some: { taxonomyValueId: categoryValueId } }
		},
		select: {
			id: true,
			title: true,
			slug: true,
			createdAt: true,
			author: { select: { name: true } },
			...publicPostTaxonomySelect
		},
		orderBy: { createdAt: 'desc' },
		take: RELATED_POSTS_LIMIT
	});
	return posts.map(toPublicPost);
}

/** Valeurs de la taxonomie « Catégorie », pour le filtre de la vitrine. */
export async function listBlogCategories() {
	const taxonomy = await prisma.blogTaxonomy.findUnique({
		where: { slug: CATEGORY_TAXONOMY_SLUG },
		select: {
			values: { select: { id: true, value: true, label: true }, orderBy: { value: 'asc' } }
		}
	});
	return (taxonomy?.values ?? []).map((v) => ({ id: v.id, name: v.label || v.value }));
}

/** Valeurs de la taxonomie « Tag », pour le filtre de la vitrine. */
export async function listBlogTags() {
	const taxonomy = await prisma.blogTaxonomy.findUnique({
		where: { slug: TAG_TAXONOMY_SLUG },
		select: {
			values: { select: { id: true, value: true, label: true }, orderBy: { value: 'asc' } }
		}
	});
	return (taxonomy?.values ?? []).map((v) => ({ id: v.id, name: v.label || v.value }));
}

/** Mots par minute de lecture retenus pour l'estimation affichée sur la fiche. */
const WORDS_PER_MINUTE = 200;

/** Estimation grossière (mots ≈ `content` sans balises HTML / 200 mots/min), toujours >= 1. */
export function estimateReadingMinutes(html: string): number {
	const text = html.replace(/<[^>]*>/g, ' ');
	const wordCount = text.split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}
