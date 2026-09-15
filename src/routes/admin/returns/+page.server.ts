import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { assertAdmin, requireAdmin } from '$lib/admin/guards';
import {
	getAllReturnRequests,
	getReturnRequestById,
	markReturnApproved,
	markReturnRejected
} from '$lib/prisma/returns/returns';
import { stripe } from '$lib/server/stripe';

/**
 * Gestion admin des demandes de retour (`ReturnRequest`).
 *
 * COMMERCE-PLUGIN : approuver déclenche un remboursement Stripe intégral et
 * automatique (voir clarification produit) — `Transaction.stripePaymentId`
 * est l'id de la Checkout Session, pas du PaymentIntent : il faut d'abord la
 * relire (`sessions.retrieve` avec `expand: ['payment_intent']`) avant de
 * pouvoir appeler `stripe.refunds.create`.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	assertAdmin(locals);

	const { items, total, page, perPage } = await getAllReturnRequests({
		page: Number(url.searchParams.get('page')) || undefined,
		perPage: Number(url.searchParams.get('perPage')) || undefined
	});

	return {
		returnRequests: items.map((item) => ({
			...item,
			createdAt: item.createdAt.toISOString()
		})),
		total,
		page,
		perPage
	};
};

export const actions: Actions = {
	approve: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '');

		const returnRequest = await getReturnRequestById(id);
		if (!returnRequest) {
			return fail(404, { message: 'Demande introuvable' });
		}
		if (returnRequest.status !== 'REQUESTED') {
			return fail(400, { message: 'Cette demande a déjà été traitée' });
		}

		try {
			const session = await stripe.checkout.sessions.retrieve(
				returnRequest.transaction.stripePaymentId,
				{ expand: ['payment_intent'] }
			);
			const paymentIntentId =
				typeof session.payment_intent === 'string'
					? session.payment_intent
					: session.payment_intent?.id;

			if (!paymentIntentId) {
				return fail(500, { message: 'Paiement Stripe introuvable pour cette transaction' });
			}

			const refund = await stripe.refunds.create({
				payment_intent: paymentIntentId,
				amount: Math.round(returnRequest.transaction.amount * 100)
			});

			await markReturnApproved(id, refund.id);
			return { success: true };
		} catch (err) {
			console.error('Erreur remboursement Stripe:', err);
			return fail(500, { message: 'Échec du remboursement Stripe' });
		}
	},

	reject: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '');

		const returnRequest = await getReturnRequestById(id);
		if (!returnRequest) {
			return fail(404, { message: 'Demande introuvable' });
		}
		if (returnRequest.status !== 'REQUESTED') {
			return fail(400, { message: 'Cette demande a déjà été traitée' });
		}

		await markReturnRejected(id);
		return { success: true };
	}
};
