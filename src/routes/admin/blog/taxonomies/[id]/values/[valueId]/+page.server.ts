/**
 * BLOG-PLUGIN : édition d'une valeur de taxonomie blog.
 */
import type { PageServerLoad } from './$types';
import { error, fail, type Actions } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { updateBlogTaxonomyValueSchema } from '$lib/schema/BlogPost/blogTaxonomyValueSchema';
import {
	getBlogTaxonomyById,
	getBlogTaxonomyValueById,
	updateBlogTaxonomyValue
} from '$lib/prisma/blogPost/blogTaxonomies';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ params }) => {
	const [taxonomy, value] = await Promise.all([
		getBlogTaxonomyById(params.id),
		getBlogTaxonomyValueById(params.valueId)
	]);

	if (!taxonomy || !value || value.taxonomyId !== taxonomy.id) {
		error(404, 'Taxonomy value not found');
	}

	const initialData = {
		id: value.id,
		taxonomyId: value.taxonomyId,
		value: value.value,
		label: value.label ?? ''
	};
	const IupdateBlogTaxonomyValueSchema = await superValidate(
		initialData,
		zod(updateBlogTaxonomyValueSchema)
	);

	return { taxonomy, IupdateBlogTaxonomyValueSchema };
};

export const actions: Actions = {
	updateBlogTaxonomyValue: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(updateBlogTaxonomyValueSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await updateBlogTaxonomyValue({
				id: form.data.id,
				value: form.data.value,
				label: form.data.label || null
			});
			return message(form, 'Taxonomy value updated successfully');
		} catch (error) {
			console.error('Error updating blog taxonomy value:', error);
			return fail(500, { message: 'Taxonomy value update failed' });
		}
	}
};
