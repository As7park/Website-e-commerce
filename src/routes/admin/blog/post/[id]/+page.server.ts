/**
 * BLOG-PLUGIN : édition d'un article. Gardes = module admin.
 */
import type { PageServerLoad } from './$types';
import type { Actions } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { superValidate, fail, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { updateBlogPostSchema } from '$lib/schema/BlogPost/BlogPostSchema';
import { getPostById, updatePost } from '$lib/prisma/blogPost/blogPost';
import { getAllBlogTaxonomiesWithValues } from '$lib/prisma/blogPost/blogTaxonomies';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ params }) => {
	const blogPost = await getPostById(params.id);
	const taxonomies = await getAllBlogTaxonomiesWithValues();

	if (!blogPost) {
		error(404, 'Blog post not found');
	}

	const initialData = {
		id: blogPost.id,
		title: blogPost.title,
		content: blogPost.content,
		taxonomyValueIds: blogPost.taxonomyValues.map((t) => t.taxonomyValueId),
		published: blogPost.published,
		authorId: blogPost.authorId
	};

	const IupdateBlogPostSchema = await superValidate(initialData, zod(updateBlogPostSchema));

	return {
		taxonomies,
		IupdateBlogPostSchema
	};
};

export const actions: Actions = {
	updatePost: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		// console.log('Raw Form data:', formData);

		// Convertir formData en objet exploitable
		const cleanData: Record<string, unknown> = Object.fromEntries(formData.entries());

		// Vérifier et nettoyer taxonomyValueIds (éviter [undefined])
		if (cleanData.taxonomyValueIds) {
			// Si c'est une seule valeur, la convertir en tableau
			if (!Array.isArray(cleanData.taxonomyValueIds)) {
				cleanData.taxonomyValueIds = [cleanData.taxonomyValueIds];
			}

			// Filtrer les valeurs nulles ou undefined
			cleanData.taxonomyValueIds = (cleanData.taxonomyValueIds as unknown[]).filter(Boolean);
		} else {
			// S'assurer que c'est toujours un tableau vide
			cleanData.taxonomyValueIds = [];
		}

		const raw: Record<string, unknown> = Object.fromEntries(formData);
		// Convert the "published" field to a boolean
		raw.published = raw.published === 'on';

		// console.log('Cleaned Form data:', cleanData);

		// Maintenant, on passe les données propres à superValidate
		const form = await superValidate(cleanData, zod(updateBlogPostSchema));
		// console.log('Validated Form data:', form);

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await updatePost(form.data);

			return message(form, 'Post updated successfully');
		} catch (error) {
			console.error('Error updating blog post:', error);
			return fail(500, { message: 'Failed to update post' });
		}
	}
};
