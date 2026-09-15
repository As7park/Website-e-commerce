import type { PageServerLoad } from './$types';
import { type Actions } from '@sveltejs/kit';
import { superValidate, fail, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { createMaterialSchema } from '$lib/schema/materials/materialSchema';
import { createMaterial } from '$lib/prisma/materials/materials';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async () => {
	const IcreateMaterialSchema = await superValidate(zod(createMaterialSchema));
	return { IcreateMaterialSchema };
};

export const actions: Actions = {
	createMaterial: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(createMaterialSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await createMaterial({ name: form.data.name });
			return message(form, 'Material created successfully');
		} catch (error) {
			console.error('Error creating material:', error);
			return fail(500, { message: 'Material creation failed' });
		}
	}
};
