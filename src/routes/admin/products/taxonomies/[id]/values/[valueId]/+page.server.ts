import type { PageServerLoad } from './$types';
import { error, fail, type Actions } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { updateTaxonomyValueSchema } from '$lib/schema/taxonomies/taxonomyValueSchema';
import { getTaxonomyById } from '$lib/prisma/taxonomies/taxonomies';
import {
	getTaxonomyValueById,
	updateTaxonomyValue,
	resolveDescendantIds
} from '$lib/prisma/taxonomies/taxonomyValues';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ params }) => {
	const [taxonomy, value] = await Promise.all([
		getTaxonomyById(params.id),
		getTaxonomyValueById(params.valueId)
	]);

	if (!taxonomy || !value || value.taxonomyId !== taxonomy.id) {
		error(404, 'Taxonomy value not found');
	}

	// Une valeur ne peut pas devenir son propre descendant : on retire
	// elle-même et ses enfants de la liste des parents proposés.
	const excluded = new Set(resolveDescendantIds(taxonomy.values, value.id));
	const availableParents = taxonomy.values.filter((v) => !excluded.has(v.id));

	const initialData = {
		id: value.id,
		taxonomyId: value.taxonomyId,
		value: value.value,
		label: value.label ?? '',
		description: value.description ?? '',
		image: value.image ?? '',
		code: value.code ?? '',
		parentId: value.parentId ?? ''
	};
	const IupdateTaxonomyValueSchema = await superValidate(
		initialData,
		zod(updateTaxonomyValueSchema)
	);

	return { taxonomy, availableParents, IupdateTaxonomyValueSchema };
};

export const actions: Actions = {
	updateTaxonomyValue: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(updateTaxonomyValueSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await updateTaxonomyValue({
				id: form.data.id,
				value: form.data.value,
				label: form.data.label || null,
				description: form.data.description || null,
				image: form.data.image || null,
				code: form.data.code || null,
				parentId: form.data.parentId || null
			});
			return message(form, 'Taxonomy value updated successfully');
		} catch (error) {
			console.error('Error updating taxonomy value:', error);
			return fail(500, { message: 'Taxonomy value update failed' });
		}
	}
};
