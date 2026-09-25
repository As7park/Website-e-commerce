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
import { nextCreditNoteNumber } from '$lib/server/creditNote/number';

export async function getReturnRequestByTransactionId(transactionId: string) {
	return prisma.returnRequest.findUnique({ where: { transactionId } });
}

export async function createReturnRequest(data: {
	transactionId: string;
	userId: string;
	reason: string;
	/** Rétractation légale (14 jours, sans motif) ou SAV — voir `ReturnKind`. */
	kind: 'WITHDRAWAL' | 'WARRANTY';
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
		include: { transaction: true, user: { select: { email: true } } },
		where: { id }
	});
}

export async function markReturnApproved(id: string, stripeRefundId: string) {
	// Numéro d'avoir alloué dans la même transaction que le changement de
	// statut : le statut ne repasse jamais par REQUESTED, donc ce numéro
	// n'est alloué qu'une seule fois par retour (idempotence structurelle).
	return prisma.$transaction(async (tx) => {
		const creditNoteNumber = await nextCreditNoteNumber(tx);
		return tx.returnRequest.update({
			where: { id },
			data: { status: 'REFUNDED', stripeRefundId, creditNoteNumber }
		});
	});
}

/** Alternative à `markReturnApproved` : crédit compte (`GiftCard`) au lieu d'un remboursement Stripe. */
export async function markReturnCredited(id: string, giftCardId: string) {
	return prisma.$transaction(async (tx) => {
		const creditNoteNumber = await nextCreditNoteNumber(tx);
		return tx.returnRequest.update({
			where: { id },
			data: { status: 'CREDITED', giftCardId, creditNoteNumber }
		});
	});
}

export async function markReturnRejected(id: string) {
	return prisma.returnRequest.update({
		where: { id },
		data: { status: 'REJECTED' }
	});
}
