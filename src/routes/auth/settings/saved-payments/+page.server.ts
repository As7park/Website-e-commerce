import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';
import {
	listSavedPaymentMethods,
	createSavedPaymentMethod,
	getSavedPaymentMethodById,
	deleteSavedPaymentMethod,
	setDefaultSavedPaymentMethod
} from '$lib/prisma/savedPayments/savedPayments';
import { stripe } from '$lib/server/stripe';

/**
 * Cartes enregistrées du compte (`SavedPaymentMethod`).
 *
 * COMMERCE-PLUGIN / AUTH-PLUGIN : module activable — 404 si désactivé, comme
 * `/auth/settings/wishlist`. L'ajout d'une carte se fait via Stripe Elements
 * côté client (`+page.svelte`) : ce fichier ne voit jamais un numéro de
 * carte, seulement l'id du `PaymentMethod` déjà confirmé par Stripe.
 */
export const load = (async ({ locals }) => {
	const userId = locals.user?.id;
	if (!userId) {
		redirect(302, '/auth/login');
	}

	const { savedPaymentsEnabled } = await getStoreFeatureFlags();
	if (!savedPaymentsEnabled) {
		error(404, 'Page introuvable');
	}

	const paymentMethods = await listSavedPaymentMethods(userId);
	return { paymentMethods };
}) satisfies PageServerLoad;

export const actions: Actions = {
	/**
	 * Appelée côté client une fois `stripe.confirmCardSetup` résolu avec
	 * succès : le `PaymentMethod` existe déjà chez Stripe, on récupère juste
	 * ses métadonnées d'affichage (`card.brand/last4/exp*`) pour la copie
	 * locale.
	 */
	attach: async ({ request, locals }) => {
		const userId = locals.user?.id;
		if (!userId) {
			return fail(401, { message: 'Non connecté' });
		}

		const formData = await request.formData();
		const paymentMethodId = String(formData.get('paymentMethodId') ?? '');
		if (!paymentMethodId) {
			return fail(400, { message: 'Carte manquante' });
		}

		try {
			const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
			if (!paymentMethod.card) {
				return fail(400, { message: 'Moyen de paiement invalide' });
			}

			const existingCount = await listSavedPaymentMethods(userId);

			await createSavedPaymentMethod({
				userId,
				stripePaymentMethodId: paymentMethod.id,
				brand: paymentMethod.card.brand,
				last4: paymentMethod.card.last4,
				expMonth: paymentMethod.card.exp_month,
				expYear: paymentMethod.card.exp_year,
				isDefault: existingCount.length === 0
			});

			return { success: true };
		} catch (err) {
			console.error('Erreur ajout carte enregistrée:', err);
			return fail(500, { message: "Échec de l'enregistrement de la carte" });
		}
	},

	delete: async ({ request, locals }) => {
		const userId = locals.user?.id;
		if (!userId) {
			return fail(401, { message: 'Non connecté' });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '');
		const card = await getSavedPaymentMethodById(userId, id);
		if (!card) {
			return fail(404, { message: 'Carte introuvable' });
		}

		try {
			await stripe.paymentMethods.detach(card.stripePaymentMethodId);
		} catch (err) {
			// Déjà détachée côté Stripe (double clic, webhook) : on continue la
			// suppression locale plutôt que de bloquer l'utilisateur.
			console.error('Erreur détachement PaymentMethod Stripe:', err);
		}

		await deleteSavedPaymentMethod(userId, id);
		return { success: true };
	},

	setDefault: async ({ request, locals }) => {
		const userId = locals.user?.id;
		if (!userId) {
			return fail(401, { message: 'Non connecté' });
		}

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '');
		await setDefaultSavedPaymentMethod(userId, id);
		return { success: true };
	}
};
