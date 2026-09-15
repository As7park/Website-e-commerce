import type { PageServerLoad } from './$types';
import { error, type Actions, fail } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { deleteVariantSchema } from '$lib/schema/products/variantSchema';
import { deleteVariantById, getVariantsForProduct, VariantInUseError } from '$lib/prisma/productVariants/productVariants';
import { getProductById } from '$lib/prisma/products/products';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ params }) => {
	const product = await getProductById(params.id);
	if (!product) {
		error(404, 'Product not found');
	}

	const variants = await getVariantsForProduct(params.id);
	const IdeleteVariantSchema = await superValidate(zod(deleteVariantSchema));

	return { product, variants, IdeleteVariantSchema };
};

export const actions: Actions = {
	deleteVariant: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(deleteVariantSchema));
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { message: 'Variant ID is required' });
		}

		try {
			await deleteVariantById(id);
			return message(form, 'Variante supprimée avec succès');
		} catch (err) {
			if (err instanceof VariantInUseError) {
				return fail(409, { message: 'Cette variante a déjà été commandée et ne peut pas être supprimée.' });
			}
			console.error('Error deleting variant:', err);
			return fail(500, { message: 'Échec de la suppression de la variante' });
		}
	}
};
