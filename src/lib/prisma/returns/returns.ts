/**
 * Accès Prisma aux demandes de retour (`ReturnRequest`).
 *
 * COMMERCE-PLUGIN : module activable, voir `StoreSettings.returnsEnabled`
 * (`$lib/server/storeSettings.ts`) — chaque route appelante vérifie déjà le
 * flag avant d'arriver ici. Le remboursement Stripe lui-même (approbation)
 * vit dans la route admin, pas ici : ce fichier ne fait que la persistance.
 */
import { prisma } from '$lib/server';
import { normalizeListParams, type ListParams } from '$lib/prisma/pagination';

export async function getReturnRequestByTransactionId(transactionId: string) {
	return prisma.returnRequest.findUnique({ where: { transactionId } });
}

export async function createReturnRequest(data: {
	transactionId: string;
	userId: string;
	reason: string;
}) {
	return prisma.returnRequest.create({ data });
}

const RETURN_SORTABLE = ['createdAt', 'status'] as const;

/** Liste paginée pour `/admin/returns`. */
export const getAllReturnRequests = async (params: ListParams = {}) => {
	const { page, perPage, skip, sort, dir } = normalizeListParams(params, {
		perPage: 20,
		defaultSort: 'createdAt',
		sortable: RETURN_SORTABLE
	});

	const [items, total] = await Promise.all([
		prisma.returnRequest.findMany({
			include: {
				user: { select: { email: true, name: true } },
				transaction: { select: { invoiceNumber: true, amount: true, stripePaymentId: true } }
			},
			orderBy: { [sort]: dir },
			skip,
			take: perPage
		}),
		prisma.returnRequest.count()
	]);

	return { items, total, page, perPage, sort, dir };
};

export async function getReturnRequestById(id: string) {
	return prisma.returnRequest.findUnique({
		include: { transaction: true },
		where: { id }
	});
}

export async function markReturnApproved(id: string, stripeRefundId: string) {
	return prisma.returnRequest.update({
		where: { id },
		data: { status: 'REFUNDED', stripeRefundId }
	});
}

export async function markReturnRejected(id: string) {
	return prisma.returnRequest.update({
		where: { id },
		data: { status: 'REJECTED' }
	});
}
