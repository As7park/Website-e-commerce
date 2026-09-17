/**
 * BLOG-PLUGIN : édition d'une taxonomie blog + suppression de ses valeurs.
 * Mirroring de `/admin/products/taxonomies/[id]`.
 */
import type { PageServerLoad } from './$types';
import { error, fail, type Actions } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { updateBlogTaxonomySchema } from '$lib/schema/BlogPost/blogTaxonomySchema';
import { deleteBlogTaxonomyValueSchema } from '$lib/schema/BlogPost/blogTaxonomyValueSchema';
import { getBlogTaxonomyById, updateBlogTaxonomy } from '$lib/prisma/blogPost/blogTaxonomies';
import { deleteBlogTaxonomyValueById } from '$lib/prisma/blogPost/blogTaxonomies';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ params }) => {
	const taxonomy = await getBlogTaxonomyById(params.id);

	if (!taxonomy) {
		error(404, 'Taxonomy not found');
	}

	const initialData = {
		id: taxonomy.id,
		name: taxonomy.name,
		slug: taxonomy.slug,
		multiple: taxonomy.multiple
	};
	const IupdateBlogTaxonomySchema = await superValidate(initialData, zod(updateBlogTaxonomySchema));
	const IdeleteBlogTaxonomyValueSchema = await superValidate(zod(deleteBlogTaxonomyValueSchema));

	return { taxonomy, IupdateBlogTaxonomySchema, IdeleteBlogTaxonomyValueSchema };
};

export const actions: Actions = {
	updateBlogTaxonomy: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(updateBlogTaxonomySchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await updateBlogTaxonomy({
				id: form.data.id,
				name: form.data.name,
				slug: form.data.slug,
				multiple: form.data.multiple
			});
			return message(form, 'Taxonomy updated successfully');
		} catch (error) {
			console.error('Error updating blog taxonomy:', error);
			return fail(500, { message: 'Taxonomy update failed' });
		}
	},
	deleteBlogTaxonomyValue: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(deleteBlogTaxonomyValueSchema));
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { message: 'Taxonomy value ID is required' });
		}

		try {
			await deleteBlogTaxonomyValueById(id);
			return message(form, 'Taxonomy value deleted successfully');
		} catch (error) {
			console.error('Error deleting blog taxonomy value:', error);
			return fail(500, { message: 'Taxonomy value deletion failed' });
		}
	}
};
