/**
 * BLOG-PLUGIN : création d'une valeur de taxonomie blog (ex: un nom de tag).
 */
import type { PageServerLoad } from './$types';
import { error, fail, type Actions } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { createBlogTaxonomyValueSchema } from '$lib/schema/BlogPost/blogTaxonomyValueSchema';
import { getBlogTaxonomyById, createBlogTaxonomyValue } from '$lib/prisma/blogPost/blogTaxonomies';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ params }) => {
	const taxonomy = await getBlogTaxonomyById(params.id);

	if (!taxonomy) {
		error(404, 'Taxonomy not found');
	}

	const IcreateBlogTaxonomyValueSchema = await superValidate(
		{ taxonomyId: taxonomy.id },
		zod(createBlogTaxonomyValueSchema)
	);

	return { taxonomy, IcreateBlogTaxonomyValueSchema };
};

export const actions: Actions = {
	createBlogTaxonomyValue: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(createBlogTaxonomyValueSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await createBlogTaxonomyValue({
				taxonomyId: form.data.taxonomyId,
				value: form.data.value,
				label: form.data.label || null
			});
			return message(form, 'Taxonomy value created successfully');
		} catch (error) {
			console.error('Error creating blog taxonomy value:', error);
			return fail(500, { message: 'Taxonomy value creation failed' });
		}
	}
};
