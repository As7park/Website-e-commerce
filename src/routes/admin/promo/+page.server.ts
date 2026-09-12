import type { PageServerLoad } from './$types';
import { type Actions, fail } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { deletePromoSchema } from '$lib/schema/promo/promoSchema';
import { getAllPromoCodes, getPromoCodeById, deletePromoCode } from '$lib/prisma/promo/promo';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ url }) => {
	const { items, total, page, perPage, search, sort, dir } = await getAllPromoCodes({
		page: Number(url.searchParams.get('page')) || undefined,
		perPage: Number(url.searchParams.get('perPage')) || undefined,
		search: url.searchParams.get('q') ?? undefined,
		sort: url.searchParams.get('sort') ?? undefined,
		dir: url.searchParams.get('dir') === 'desc' ? 'desc' : undefined
	});
	const IdeletePromoSchema = await superValidate(zod(deletePromoSchema));

	return {
		promoCodes: items,
		total,
		page,
		perPage,
		search,
		sort,
		dir,
		IdeletePromoSchema
	};
};

export const actions: Actions = {
	deletePromo: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(deletePromoSchema));
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { message: 'ID du code promo requis' });
		}

		try {
			const existing = await getPromoCodeById(id);
			if (!existing) {
				return fail(400, { message: 'Code promo introuvable' });
			}
			await deletePromoCode(id);
			return message(form, 'Code promo supprimé avec succès');
		} catch (error) {
			console.error('Error deleting promo code:', error);
			return fail(500, { message: 'Échec de la suppression du code promo' });
		}
	}
};
