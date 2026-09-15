import type { PageServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { getTransactionsByUserId } from '$lib/prisma/transaction/getTransactionsByUserId';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';
import { prisma } from '$lib/server';

/**
 * Liste des commandes payées de l'utilisateur, avec le statut de retour
 * éventuel — sert de point d'entrée avant `/auth/settings/returns/[id]`.
 */
export const load = (async ({ locals, url }) => {
	const userId = locals.user?.id;
	if (!userId) {
		redirect(302, '/auth/login');
	}

	const { returnsEnabled } = await getStoreFeatureFlags();
	if (!returnsEnabled) {
		error(404, 'Page introuvable');
	}

	const { items } = await getTransactionsByUserId(userId, {
		page: Number(url.searchParams.get('page')) || undefined,
		perPage: 50
	});

	const paidTransactions = items.filter((t) => t.hasFacture);
	const returnRequests = await prisma.returnRequest.findMany({
		where: { transactionId: { in: paidTransactions.map((t) => t.id) } },
		select: { transactionId: true, status: true }
	});
	const statusByTransactionId = new Map(returnRequests.map((r) => [r.transactionId, r.status]));

	return {
		transactions: paidTransactions.map((t) => ({
			...t,
			createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
			returnStatus: statusByTransactionId.get(t.id) ?? null
		}))
	};
}) satisfies PageServerLoad;
