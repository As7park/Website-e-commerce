import type { PageServerLoad, Actions } from './$types';
import { error } from '@sveltejs/kit';
import { superValidate, fail, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import {
	updateGiftCardSchema,
	adjustGiftCardBalanceSchema
} from '$lib/schema/giftCards/giftCardSchema';
import {
	getGiftCardById,
	updateGiftCard,
	adjustGiftCardBalance
} from '$lib/prisma/giftCards/giftCards';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ params }) => {
	const giftCard = await getGiftCardById(params.id);

	if (!giftCard) {
		error(404, 'Carte cadeau introuvable');
	}

	const updateGiftCardForm = await superValidate(
		{
			id: giftCard.id,
			active: giftCard.active,
			recipientEmail: giftCard.recipientEmail ?? undefined,
			note: giftCard.note ?? undefined,
			expiresAt: giftCard.expiresAt ? giftCard.expiresAt.toISOString().slice(0, 10) : undefined
		},
		zod(updateGiftCardSchema)
	);
	const adjustBalanceForm = await superValidate(
		{ id: giftCard.id, balance: giftCard.balance },
		zod(adjustGiftCardBalanceSchema)
	);

	return { giftCard, updateGiftCardForm, adjustBalanceForm };
};

export const actions: Actions = {
	updateGiftCard: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(updateGiftCardSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await updateGiftCard(form.data.id, {
				active: form.data.active,
				recipientEmail: form.data.recipientEmail,
				note: form.data.note,
				expiresAt: form.data.expiresAt
			});

			return message(form, 'Carte cadeau mise à jour avec succès');
		} catch (error) {
			console.error('Error updating gift card:', error);
			return fail(500, { message: 'Échec de la mise à jour de la carte cadeau' });
		}
	},

	adjustBalance: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(adjustGiftCardBalanceSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await adjustGiftCardBalance(form.data.id, form.data.balance);
			return message(form, 'Solde ajusté avec succès');
		} catch (error) {
			console.error('Error adjusting gift card balance:', error);
			return fail(500, { message: "Échec de l'ajustement du solde" });
		}
	}
};
