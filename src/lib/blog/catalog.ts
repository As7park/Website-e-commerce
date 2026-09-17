// -----------------------------------------------------------------------------
// Lecture publique du blog.
//
// Point d'entrée de la vitrine : uniquement les articles `published`. Les
// brouillons restent dans le CRUD admin. Retirer le module, pour ce fichier,
// se résume à ne plus appeler ces lecteurs depuis les routes `/blog`.
// BLOG-PLUGIN
// -----------------------------------------------------------------------------

import { prisma } from '$lib/server';

// La vitrine suppose une taxonomie "catégorie" (nav de filtre, une par
// article) et une taxonomie "tag" (affichage libre, plusieurs par article) —
// créées par le backfill de la migration `20260917270000_add_blog_taxonomies`.
// Toute autre taxonomie créée en admin n'apparaît pas ici (pas de nav dédiée).
const CATEGORY_TAXONOMY_SLUG = 'categorie';
const TAG_TAXONOMY_SLUG = 'tag';

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
		.map(({ taxonomyValue }) => ({ tag: { name: taxonomyValue.label || taxonomyValue.value } }));

	return {
		...post,
		category: categoryValue
			? { id: categoryValue.id, name: categoryValue.label || categoryValue.value }
			: null,
		tags
	};
}

export type PublicPost = Awaited<ReturnType<typeof listPublishedPosts>>[number];

/** Articles publiés, éventuellement filtrés par valeur de catégorie. `content` n'est pas chargé (non affiché en liste). */
export async function listPublishedPosts(categoryValueId?: string) {
	const posts = await prisma.blogPost.findMany({
		where: {
			published: true,
			...(categoryValueId ? { taxonomyValues: { some: { taxonomyValueId: categoryValueId } } } : {})
		},
		select: {
			id: true,
			title: true,
			slug: true,
			createdAt: true,
			author: { select: { name: true } },
			...publicPostTaxonomySelect
		},
		orderBy: { createdAt: 'desc' }
	});
	return posts.map(toPublicPost);
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
