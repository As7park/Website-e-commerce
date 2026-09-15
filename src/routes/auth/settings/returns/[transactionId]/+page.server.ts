import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/server';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';
import { createReturnRequest, getReturnRequestByTransactionId } from '$lib/prisma/returns/returns';

/**
 * Demande de retour sur une transaction payée.
 *
 * COMMERCE-PLUGIN / AUTH-PLUGIN : module activable — 404 si désactivé. Une
 * transaction ne peut avoir qu'une seule demande (`ReturnRequest.transactionId`
 * unique) : si elle existe déjà, cette page affiche son statut au lieu du
 * formulaire de demande.
 */
export const load = (async ({ locals, params }) => {
	const userId = locals.user?.id;
	if (!userId) {
		redirect(302, '/auth/login');
	}

	const { returnsEnabled } = await getStoreFeatureFlags();
	if (!returnsEnabled) {
		error(404, 'Page introuvable');
	}

	const transaction = await prisma.transaction.findUnique({
		where: { id: params.transactionId },
		select: { id: true, userId: true, status: true, invoiceNumber: true, amount: true }
	});
	if (!transaction || transaction.userId !== userId) {
		error(404, 'Facture introuvable');
	}
	if (transaction.status !== 'paid') {
		error(400, "Cette commande ne peut pas faire l'objet d'un retour");
	}

	const returnRequest = await getReturnRequestByTransactionId(transaction.id);

	return { transaction, returnRequest };
}) satisfies PageServerLoad;

export const actions: Actions = {
	request: async ({ request, locals, params }) => {
		const userId = locals.user?.id;
		if (!userId) {
			return fail(401, { message: 'Non connecté' });
		}

		const { returnsEnabled } = await getStoreFeatureFlags();
		if (!returnsEnabled) {
			return fail(404, { message: 'Module désactivé' });
		}

		const transaction = await prisma.transaction.findUnique({
			where: { id: params.transactionId },
			select: { id: true, userId: true, status: true }
		});
		if (!transaction || transaction.userId !== userId || transaction.status !== 'paid') {
			return fail(404, { message: 'Facture introuvable' });
		}

		const existing = await getReturnRequestByTransactionId(transaction.id);
		if (existing) {
			return fail(400, { message: 'Une demande existe déjà pour cette commande' });
		}

		const formData = await request.formData();
		const reason = String(formData.get('reason') ?? '').trim();
		if (!reason) {
			return fail(400, { message: 'Merci de préciser le motif du retour' });
		}

		await createReturnRequest({ transactionId: transaction.id, userId, reason });

		return { success: true };
	}
};
