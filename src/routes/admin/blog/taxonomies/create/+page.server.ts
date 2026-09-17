/**
 * BLOG-PLUGIN : création d'une taxonomie blog (ex: Catégorie, Tag, ou toute
 * nouvelle facette). Mirroring de `/admin/products/taxonomies/create`.
 */
import type { PageServerLoad } from './$types';
import { fail, type Actions } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { createBlogTaxonomySchema } from '$lib/schema/BlogPost/blogTaxonomySchema';
import { createBlogTaxonomy } from '$lib/prisma/blogPost/blogTaxonomies';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async () => {
	const IcreateBlogTaxonomySchema = await superValidate(
		{ multiple: true },
		zod(createBlogTaxonomySchema)
	);
	return { IcreateBlogTaxonomySchema };
};

export const actions: Actions = {
	createBlogTaxonomy: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(createBlogTaxonomySchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await createBlogTaxonomy({
				name: form.data.name,
				slug: form.data.slug,
				multiple: form.data.multiple
			});
			return message(form, 'Taxonomy created successfully');
		} catch (error) {
			console.error('Error creating blog taxonomy:', error);
			return fail(500, { message: 'Taxonomy creation failed' });
		}
	}
};
