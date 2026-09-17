import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { estimateReadingMinutes, getPublishedPostBySlug, getRelatedPosts } from '$lib/blog/catalog';

/**
 * Article public.
 *
 * BLOG-PLUGIN : 404 si le slug n'existe pas ou si l'article n'est pas publié.
 */
export const load: PageServerLoad = async ({ params }) => {
	const post = await getPublishedPostBySlug(params.slug);
	if (!post) {
		error(404, 'Article introuvable');
	}

	const relatedPosts = await getRelatedPosts(post.id, post.category?.id);

	return { post, relatedPosts, readingMinutes: estimateReadingMinutes(post.content) };
};
