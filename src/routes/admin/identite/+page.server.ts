import { fail, type Actions } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { PageServerLoad } from './$types';
import { assertAdmin, requireAdmin } from '$lib/admin/guards';
import { getCompanyIdentity, updateCompanyIdentity } from '$lib/server/companyIdentity';
import { companyIdentitySchema } from '$lib/schema/settings/companyIdentitySchema';
import { log } from '$lib/server/log';

/**
 * Identité de l'entreprise (`StoreSettings.company*`) — voir
 * CONFORMITE_ECOMMERCE.md : alimente `/mentions-legales` et les
 * factures/avoirs, remplace les `[À COMPLÉTER]` et les variables
 * d'environnement `INVOICE_COMPANY_*`. Un champ vide reste `null` (pas de
 * valeur inventée).
 *
 * ADMIN-PLUGIN : page dédiée (déplacée depuis `/admin/settings`) — une
 * saisie qui n'a lieu qu'une fois ou rarement, distincte des interrupteurs
 * de modules et des réglages commerciaux modifiés plus souvent.
 */
export const load = (async ({ locals }) => {
	assertAdmin(locals);
	const companyIdentity = await getCompanyIdentity();
	const companyForm = await superValidate(
		{
			name: companyIdentity.name ?? '',
			legalForm: companyIdentity.legalForm ?? '',
			shareCapital: companyIdentity.shareCapital ?? '',
			address: companyIdentity.address ?? '',
			city: companyIdentity.city ?? '',
			siret: companyIdentity.siret ?? '',
			vatNumber: companyIdentity.vatNumber ?? '',
			publicationDirector: companyIdentity.publicationDirector ?? '',
			phone: companyIdentity.phone ?? '',
			email: companyIdentity.email ?? ''
		},
		zod(companyIdentitySchema),
		{ id: 'companyIdentity' }
	);
	return { companyForm };
}) satisfies PageServerLoad;

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(companyIdentitySchema), {
			id: 'companyIdentity'
		});

		if (!form.valid) {
			return fail(400, { companyForm: form });
		}

		try {
			const blank = (value: string | undefined) => (value && value.trim() ? value.trim() : null);
			await updateCompanyIdentity({
				name: blank(form.data.name),
				legalForm: blank(form.data.legalForm),
				shareCapital: blank(form.data.shareCapital),
				address: blank(form.data.address),
				city: blank(form.data.city),
				siret: blank(form.data.siret),
				vatNumber: blank(form.data.vatNumber),
				publicationDirector: blank(form.data.publicationDirector),
				phone: blank(form.data.phone),
				email: blank(form.data.email)
			});
			log(
				'INFO',
				'admin-identite',
				`Identité de l'entreprise mise à jour par ${locals.user.email}`
			);
			return message(form, 'Identité de l’entreprise mise à jour');
		} catch (error) {
			console.error('Error updating company identity:', error);
			return fail(500, {
				companyForm: form,
				message: "La mise à jour n'a pas pu être enregistrée."
			});
		}
	}
};
