import type { PageServerLoad } from './$types';
import { error, fail, type Actions } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { updateTaxonomySchema } from '$lib/schema/taxonomies/taxonomySchema';
import { deleteTaxonomyValueSchema } from '$lib/schema/taxonomies/taxonomyValueSchema';
import { getTaxonomyById, updateTaxonomy } from '$lib/prisma/taxonomies/taxonomies';
import { deleteTaxonomyValueById } from '$lib/prisma/taxonomies/taxonomyValues';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ params }) => {
	const taxonomy = await getTaxonomyById(params.id);

	if (!taxonomy) {
		error(404, 'Taxonomy not found');
	}

	const initialData = {
		id: taxonomy.id,
		name: taxonomy.name,
		slug: taxonomy.slug,
		type: taxonomy.type,
		multiple: taxonomy.multiple,
		numberMin: taxonomy.numberMin ?? undefined,
		numberMax: taxonomy.numberMax ?? undefined,
		numberUnit: taxonomy.numberUnit ?? ''
	};
	const IupdateTaxonomySchema = await superValidate(initialData, zod(updateTaxonomySchema));
	const IdeleteTaxonomyValueSchema = await superValidate(zod(deleteTaxonomyValueSchema));

	return { taxonomy, IupdateTaxonomySchema, IdeleteTaxonomyValueSchema };
};

export const actions: Actions = {
	updateTaxonomy: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(updateTaxonomySchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await updateTaxonomy({
				id: form.data.id,
				name: form.data.name,
				slug: form.data.slug,
				type: form.data.type,
				multiple: form.data.multiple,
				numberMin: form.data.numberMin ?? null,
				numberMax: form.data.numberMax ?? null,
				numberUnit: form.data.numberUnit || null
			});
			return message(form, 'Taxonomy updated successfully');
		} catch (error) {
			console.error('Error updating taxonomy:', error);
			return fail(500, { message: 'Taxonomy update failed' });
		}
	},
	deleteTaxonomyValue: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(deleteTaxonomyValueSchema));
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { message: 'Taxonomy value ID is required' });
		}

		try {
			await deleteTaxonomyValueById(id);
			return message(form, 'Taxonomy value deleted successfully');
		} catch (error) {
			console.error('Error deleting taxonomy value:', error);
			return fail(500, { message: 'Taxonomy value deletion failed' });
		}
	}
};
