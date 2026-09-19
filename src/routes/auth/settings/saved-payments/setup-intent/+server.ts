import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';
import { ensureStripeCustomer } from '$lib/server/stripeCustomer';
import { stripe } from '$lib/server/stripe';

/**
 * Crée un `SetupIntent` Stripe pour le compte connecté — appelé en `fetch`
 * par `+page.svelte` juste avant `stripe.confirmCardSetup`, pas une action de
 * formulaire classique : la réponse (client secret) doit arriver au JS avant
 * tout rendu Stripe Elements, pas après un rechargement de page.
 */
export const POST: RequestHandler = async ({ locals }) => {
	const userId = locals.user?.id;
	if (!userId) {
		error(401, 'Non connecté');
	}

	const { savedPaymentsEnabled } = await getStoreFeatureFlags();
	if (!savedPaymentsEnabled) {
		error(404, 'Module désactivé');
	}

	const customerId = await ensureStripeCustomer(userId);
	const setupIntent = await stripe.setupIntents.create({
		customer: customerId,
		payment_method_types: ['card']
	});

	return json({ clientSecret: setupIntent.client_secret });
};
