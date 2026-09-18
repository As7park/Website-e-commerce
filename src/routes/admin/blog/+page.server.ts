/**
 * BLOG-PLUGIN : liste et suppressions admin (articles, taxonomies).
 * Les gardes d'écriture sont celles de l'admin (`requireAdmin`).
 */
import type { PageServerLoad } from './$types';
import { type Actions } from '@sveltejs/kit';
import { superValidate, fail, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { deleteBlogPostSchema } from '$lib/schema/BlogPost/BlogPostSchema';
import { deleteBlogTaxonomySchema } from '$lib/schema/BlogPost/blogTaxonomySchema';

import { getPostById, deletePost, getAllPosts } from '$lib/prisma/blogPost/blogPost';
import {
	getAllBlogTaxonomies,
	getBlogTaxonomyById,
	deleteBlogTaxonomyById
} from '$lib/prisma/blogPost/blogTaxonomies';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ url }) => {
	const { items, total, page, perPage, search, sort, dir } = await getAllPosts({
		page: Number(url.searchParams.get('page')) || undefined,
		perPage: Number(url.searchParams.get('perPage')) || undefined,
		search: url.searchParams.get('q') ?? undefined,
		sort: url.searchParams.get('sort') ?? undefined,
		dir: url.searchParams.get('dir') === 'desc' ? 'desc' : undefined
	});
	const taxonomies = await getAllBlogTaxonomies();

	const IdeleteBlogPostSchema = await superValidate(zod(deleteBlogPostSchema));
	const IdeleteBlogTaxonomySchema = await superValidate(zod(deleteBlogTaxonomySchema));

	return {
		taxonomies,
		IdeleteBlogPostSchema,
		BlogPost: items,
		total,
		page,
		perPage,
		search,
		sort,
		dir,
		IdeleteBlogTaxonomySchema
	};
};

export const actions: Actions = {
	deleteBlogPost: async ({ request, locals }) => {
		requireAdmin(locals);
		// console.log('deletePost action initiated.', request);

		const formData = await request.formData();
		// console.log(formData, 'form data');

		const form = await superValidate(formData, zod(deleteBlogPostSchema));
		const id = formData.get('id') as string;
		// console.log('Received id:', id);
		if (!id) {
			// console.log('No id provided');
			return fail(400, { message: 'Post ID is required' });
		}
		try {
			// Vérifier si la catégorie existe
			const existingPost = await getPostById(id);
			if (!existingPost) {
				// console.log('Post not found:', id);
				return fail(400, { message: 'Post not found' });
			}
			// console.log('Post found:', existingPost);

			// Supprimer la catégorie
			await deletePost(id);
			return message(form, 'Post deleted successfully');
		} catch (error) {
			console.error('Error deleting category:', error);
			return fail(500, { message: 'Post deletion failed' });
		}
	},
	deleteBlogTaxonomy: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(deleteBlogTaxonomySchema));
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { message: 'Taxonomy ID is required' });
		}
		try {
			const existingTaxonomy = await getBlogTaxonomyById(id);
			if (!existingTaxonomy) {
				return fail(400, { message: 'Taxonomy not found' });
			}

			await deleteBlogTaxonomyById(id);

			return message(form, 'Taxonomy deleted successfully');
		} catch (error) {
			console.error('Error deleting blog taxonomy:', error);
			return fail(500, { message: 'Taxonomy deletion failed' });
		}
	}
};
