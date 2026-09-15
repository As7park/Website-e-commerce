import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { Prisma } from '@prisma/client';

import { createVariantSchema } from '$lib/schema/products/variantSchema';
import { createVariant } from '$lib/prisma/productVariants/productVariants';
import { getProductById } from '$lib/prisma/products/products';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ params }) => {
	const product = await getProductById(params.id);
	if (!product) {
		error(404, 'Product not found');
	}

	const createVariantForm = await superValidate(zod(createVariantSchema));
	return { product, createVariantForm };
};

export const actions: Actions = {
	createVariant: async ({ request, locals, params }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(createVariantSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await createVariant(params.id, {
				label: form.data.label,
				sku: form.data.sku,
				price: form.data.price > 0 ? form.data.price : null,
				stock: form.data.stock
			});
			return message(form, 'Variante créée avec succès');
		} catch (err) {
			if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
				return message(form, 'Ce SKU est déjà utilisé par une autre variante', { status: 400 });
			}
			console.error('Error creating variant:', err);
			return fail(500, { message: 'Échec de la création de la variante' });
		}
	}
};
