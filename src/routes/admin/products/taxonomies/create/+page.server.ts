import type { PageServerLoad } from './$types';
import { fail, type Actions } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { createTaxonomySchema } from '$lib/schema/taxonomies/taxonomySchema';
import { createTaxonomy } from '$lib/prisma/taxonomies/taxonomies';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async () => {
	const IcreateTaxonomySchema = await superValidate(
		{ multiple: true },
		zod(createTaxonomySchema)
	);
	return { IcreateTaxonomySchema };
};

export const actions: Actions = {
	createTaxonomy: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(createTaxonomySchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await createTaxonomy({
				name: form.data.name,
				slug: form.data.slug,
				type: form.data.type,
				multiple: form.data.multiple,
				numberMin: form.data.numberMin ?? null,
				numberMax: form.data.numberMax ?? null,
				numberUnit: form.data.numberUnit || null
			});
			return message(form, 'Taxonomy created successfully');
		} catch (error) {
			console.error('Error creating taxonomy:', error);
			return fail(500, { message: 'Taxonomy creation failed' });
		}
	}
};
