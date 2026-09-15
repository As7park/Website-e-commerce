import type { PageServerLoad, Actions } from './$types';
import { error } from '@sveltejs/kit';
import { superValidate, fail, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { Prisma } from '@prisma/client';

import { updateVariantSchema } from '$lib/schema/products/variantSchema';
import { getVariantById, updateVariant } from '$lib/prisma/productVariants/productVariants';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ params }) => {
	const variant = await getVariantById(params.variantId);

	if (!variant || variant.productId !== params.id) {
		error(404, 'Variant not found');
	}

	const updateVariantForm = await superValidate(
		{
			id: variant.id,
			label: variant.label,
			sku: variant.sku ?? undefined,
			price: variant.price ?? 0,
			stock: variant.stock
		},
		zod(updateVariantSchema)
	);

	return { variant, updateVariantForm };
};

export const actions: Actions = {
	updateVariant: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(updateVariantSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await updateVariant(form.data.id, {
				label: form.data.label,
				sku: form.data.sku,
				price: form.data.price > 0 ? form.data.price : null,
				stock: form.data.stock
			});
			return message(form, 'Variante mise à jour avec succès');
		} catch (err) {
			if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
				return message(form, 'Ce SKU est déjà utilisé par une autre variante', { status: 400 });
			}
			console.error('Error updating variant:', err);
			return fail(500, { message: 'Échec de la mise à jour de la variante' });
		}
	}
};
