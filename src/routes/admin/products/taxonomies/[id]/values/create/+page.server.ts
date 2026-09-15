import type { PageServerLoad } from './$types';
import { error, fail, type Actions } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { createTaxonomyValueSchema } from '$lib/schema/taxonomies/taxonomyValueSchema';
import { getTaxonomyById } from '$lib/prisma/taxonomies/taxonomies';
import { createTaxonomyValue } from '$lib/prisma/taxonomies/taxonomyValues';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ params }) => {
	const taxonomy = await getTaxonomyById(params.id);

	if (!taxonomy) {
		error(404, 'Taxonomy not found');
	}

	const IcreateTaxonomyValueSchema = await superValidate(
		{ taxonomyId: taxonomy.id },
		zod(createTaxonomyValueSchema)
	);

	return { taxonomy, IcreateTaxonomyValueSchema };
};

export const actions: Actions = {
	createTaxonomyValue: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(createTaxonomyValueSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await createTaxonomyValue({
				taxonomyId: form.data.taxonomyId,
				value: form.data.value,
				label: form.data.label || null,
				description: form.data.description || null,
				image: form.data.image || null,
				code: form.data.code || null,
				parentId: form.data.parentId || null
			});
			return message(form, 'Taxonomy value created successfully');
		} catch (error) {
			console.error('Error creating taxonomy value:', error);
			return fail(500, { message: 'Taxonomy value creation failed' });
		}
	}
};
