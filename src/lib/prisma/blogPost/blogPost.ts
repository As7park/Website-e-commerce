import { prisma } from '$lib/server';
import { normalizeListParams, type ListParams } from '$lib/prisma/pagination';

/**
 * BLOG-PLUGIN : DAO Prisma des articles, catégories et tags. Les lectures
 * publiques passent par `src/lib/blog/catalog.ts` (filtre `published`).
 */

const POST_SORTABLE = ['title', 'published', 'createdAt'] as const;

/**
 * Liste paginée pour `/admin/blog` : recherche sur le titre, tri sur
 * titre/statut de publication/date de création. Catégories et tags restent
 * non paginés (volumes bornés par la curation admin, pas par le trafic public).
 */
export const getAllPosts = async (params: ListParams = {}) => {
	const { page, perPage, skip, search, sort, dir } = normalizeListParams(params, {
		perPage: 20,
		defaultSort: 'createdAt',
		sortable: POST_SORTABLE
	});

	const where = search ? { title: { contains: search, mode: 'insensitive' as const } } : undefined;

	try {
		const [items, total] = await Promise.all([
			// La liste admin affiche titre/taxonomies/statut : `content`
			// (potentiellement volumineux) et `author` ne sont pas utilisés.
			prisma.blogPost.findMany({
				where,
				select: {
					id: true,
					title: true,
					published: true,
					createdAt: true,
					taxonomyValues: {
						select: {
							taxonomyValue: {
								select: { value: true, label: true, taxonomy: { select: { name: true } } }
							}
						}
					}
				},
				orderBy: { [sort]: dir },
				skip,
				take: perPage
			}),
			prisma.blogPost.count({ where })
		]);
		return { items, total, page, perPage, search, sort, dir };
	} catch (error) {
		console.error('Error retrieving posts:', error);
		return { items: [], total: 0, page, perPage, search, sort, dir };
	}
};

export const getPostBySlug = async (slug: string) => {
	try {
		const post = await prisma.blogPost.findUnique({
			where: { slug },
			include: {
				author: true,
				category: true
			}
		});
		return post;
	} catch (error) {
		console.error('Error retrieving post:', error);
	}
};

export const updatePost = async (data: {
	id: string;
	title: string;
	content: string;
	authorId: string;
	taxonomyValueIds?: string[];
	published: boolean;
}) => {
	try {
		return await prisma.$transaction(async (tx) => {
			const post = await tx.blogPost.update({
				where: { id: data.id },
				data: {
					title: data.title,
					content: data.content,
					published: data.published
				}
			});

			await tx.blogPostTaxonomyValue.deleteMany({ where: { postId: data.id } });

			if (data.taxonomyValueIds && data.taxonomyValueIds.length > 0) {
				await tx.blogPostTaxonomyValue.createMany({
					data: data.taxonomyValueIds.map((taxonomyValueId) => ({
						postId: data.id,
						taxonomyValueId
					}))
				});
			}

			return post;
		});
	} catch (error) {
		console.error('Error updating post:', error);
		throw error;
	}
};

export const getPostById = async (id: string) => {
	try {
		const post = await prisma.blogPost.findUnique({
			where: { id },
			include: {
				author: true,
				taxonomyValues: { select: { taxonomyValueId: true } }
			}
		});
		return post;
	} catch (error) {
		console.error('Error retrieving post:', error);
	}
};

// createPost.ts
// Cette fonction crée un post en enregistrant également la catégorie et les tags associés,
// en gérant séparément les relations puisque les nested writes ne sont pas supportées avec MongoDB.
export const createPost = async (
	title: string,
	content: string,
	authorId: string,
	slug: string,
	published: boolean,
	taxonomyValueIds?: string[]
) => {
	try {
		const post = await prisma.blogPost.create({
			data: { title, content, authorId, slug, published, createdAt: new Date() }
		});

		if (taxonomyValueIds && taxonomyValueIds.length > 0) {
			await prisma.blogPostTaxonomyValue.createMany({
				data: taxonomyValueIds.map((taxonomyValueId) => ({ postId: post.id, taxonomyValueId }))
			});
		}

		return post;
	} catch (error) {
		console.error('Error creating post:', error);
		throw error;
	}
};

export const deletePost = async (id: string) => {
	// console.log('Deleting post with id:', id);
	try {
		// Utiliser une transaction pour supprimer d'abord les relations, puis le post
		const deletedPost = await prisma.$transaction(async (tx) => {
			// 1. Supprimer toutes les entrées liées dans BlogPostTag
			await tx.blogPostTag.deleteMany({
				where: { postId: id }
			});

			// 2. Supprimer le post
			const post = await tx.blogPost.delete({
				where: { id }
			});
			return post;
		});

		// console.log('Post deleted successfully:', deletedPost);
		return deletedPost;
	} catch (error) {
		console.error('Error deleting post:', error);
		throw error;
	}
};

// Catégories/tags : remplacés par le système générique `blogTaxonomies.ts`
// (BlogTaxonomy/BlogTaxonomyValue). Les anciens modèles BlogCategory/BlogTag/
// BlogPostTag restent en base (données migrées, voir migration
// `20260917270000_add_blog_taxonomies`) mais ne sont plus lus/écrits ici —
// même convention que `materials`/`categories` côté produits (docs/products/README.md).
