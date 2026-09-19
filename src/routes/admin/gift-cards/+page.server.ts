import type { PageServerLoad } from './$types';
import { type Actions, fail } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { deleteGiftCardSchema } from '$lib/schema/giftCards/giftCardSchema';
import { getAllGiftCards, getGiftCardById, deleteGiftCard } from '$lib/prisma/giftCards/giftCards';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ url }) => {
	const { items, total, page, perPage, search, sort, dir } = await getAllGiftCards({
		page: Number(url.searchParams.get('page')) || undefined,
		perPage: Number(url.searchParams.get('perPage')) || undefined,
		search: url.searchParams.get('q') ?? undefined,
		sort: url.searchParams.get('sort') ?? undefined,
		dir: url.searchParams.get('dir') === 'desc' ? 'desc' : undefined
	});
	const IdeleteGiftCardSchema = await superValidate(zod(deleteGiftCardSchema));

	return {
		giftCards: items,
		total,
		page,
		perPage,
		search,
		sort,
		dir,
		IdeleteGiftCardSchema
	};
};

export const actions: Actions = {
	deleteGiftCard: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(deleteGiftCardSchema));
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { message: 'ID de carte cadeau requis' });
		}

		try {
			const existing = await getGiftCardById(id);
			if (!existing) {
				return fail(400, { message: 'Carte cadeau introuvable' });
			}
			await deleteGiftCard(id);
			return message(form, 'Carte cadeau supprimée avec succès');
		} catch (error) {
			console.error('Error deleting gift card:', error);
			return fail(500, { message: 'Échec de la suppression de la carte cadeau' });
		}
	}
};
