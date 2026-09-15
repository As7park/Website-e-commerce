import type { PageServerLoad } from './$types';
import { error, type Actions } from '@sveltejs/kit';
import { superValidate, fail, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { updateMaterialSchema } from '$lib/schema/materials/materialSchema';
import { getMaterialById, updateMaterial } from '$lib/prisma/materials/materials';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ params }) => {
	const material = await getMaterialById(params.id);

	if (!material) {
		error(404, 'Material not found');
	}

	const initialData = { id: material.id, name: material.name };
	const IupdateMaterialSchema = await superValidate(initialData, zod(updateMaterialSchema));

	return { IupdateMaterialSchema };
};

export const actions: Actions = {
	updateMaterial: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(updateMaterialSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			const materialId = formData.get('id');
			await updateMaterial({ id: materialId as string, name: form.data.name });
			return message(form, 'Material updated successfully');
		} catch (error) {
			console.error('Error updating material:', error);
			return fail(500, { message: 'Material update failed' });
		}
	}
};
