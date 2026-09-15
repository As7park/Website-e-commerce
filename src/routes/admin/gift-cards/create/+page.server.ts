import type { Actions, PageServerLoad } from './$types';
import { superValidate, fail, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { createGiftCardSchema } from '$lib/schema/giftCards/giftCardSchema';
import { createGiftCard } from '$lib/prisma/giftCards/giftCards';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async () => {
	const createGiftCardForm = await superValidate(zod(createGiftCardSchema));
	return { createGiftCardForm };
};

export const actions: Actions = {
	createGiftCard: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(createGiftCardSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			const giftCard = await createGiftCard({
				initialValue: form.data.initialValue,
				recipientEmail: form.data.recipientEmail,
				note: form.data.note,
				expiresAt: form.data.expiresAt
			});

			return message(form, `Carte cadeau créée : ${giftCard.code}`);
		} catch (error) {
			console.error('Error creating gift card:', error);
			return fail(500, { message: 'Échec de la création de la carte cadeau' });
		}
	}
};
