import type { Actions, PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { fail, message, superValidate } from 'sveltekit-superforms';
import { createAddressSchema } from '$lib/schema/addresses/addressSchema';
import { zod } from 'sveltekit-superforms/adapters';
import { createAddress } from '$lib/prisma/addresses/addresses';

export const load: PageServerLoad = async (event) => {
	// Vérification de l'authentification
	if (!event.locals.user) {
		error(401, 'Unauthorized');
	}

	// Initialisation du formulaire Superform
	const IcreateAddressSchema = await superValidate(zod(createAddressSchema));

	return {
		IcreateAddressSchema,
		userId: event.locals.user.id,
		// Permet au formulaire de revenir au checkout une fois l'adresse créée.
		redirectTarget: event.url.searchParams.get('redirect'),
		// Quel champ du checkout doit récupérer l'adresse créée (livraison / facturation).
		addressTarget: event.url.searchParams.get('target')
	};
};

export const actions: Actions = {
	createAddress: async (event) => {
		// Vérifier l'authentification
		if (!event.locals.user) {
			return fail(401, { message: 'Unauthorized' });
		}

		const formData = await event.request.formData();
		// console.log('Form Data:', formData);

		// Validation avec Superform + Zod
		const form = await superValidate(formData, zod(createAddressSchema));
		// console.log('Validated Form:', form);

		if (!form.valid) {
			return fail(400, { message: 'Validation failed', form });
		}

		const {
			first_name,
			last_name,
			phone,
			company,
			street_number,
			street,
			city,
			county,
			state,
			stateLetter,
			state_code,
			zip,
			country,
			country_code,
			ISO_3166_1_alpha_3
		} = form.data;

		// 🔥 **Forcer l'ajout de `userId` côté serveur**
		const userId = event.locals.user.id;

		let created;
		try {
			created = await createAddress({
				first_name,
				last_name,
				phone,
				company,
				street_number,
				street,
				city,
				county,
				state,
				stateLetter,
				state_code,
				zip,
				country,
				country_code,
				ISO_3166_1_alpha_3,
				userId,
				createdAt: new Date(),
				updatedAt: new Date()
			});
		} catch (err) {
			console.error('Error creating address:', err);
			return fail(500, { message: 'Address creation failed' });
		}

		// Retour au checkout : on y revient directement, adresse pré-sélectionnée
		// dans le bon champ (livraison ou facturation selon d'où vient la demande).
		if (event.url.searchParams.get('redirect') === 'checkout') {
			const target = event.url.searchParams.get('target') === 'billing' ? 'billing' : 'shipping';
			redirect(303, `/checkout?addressId=${created.id}&target=${target}`);
		}

		return message(form, 'Address created successfully');
	}
};
