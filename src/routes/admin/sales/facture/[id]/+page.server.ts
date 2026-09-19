import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getTransactionById } from '$lib/prisma/transaction/getTransactionById';
import { buildInvoiceView } from '$lib/server/invoice/view';

/**
 * Facture admin.
 *
 * ADMIN-PLUGIN / COMMERCE-PLUGIN
 */
export const load = (async ({ params }) => {
	const transactionId = params.id;
	if (!transactionId) {
		error(400, 'Transaction ID is missing');
	}

	const transaction = await getTransactionById(transactionId);
	if (!transaction) {
		error(404, 'Facture introuvable');
	}

	return {
		invoice: buildInvoiceView(transaction),
		pdfHref: `/admin/sales/facture/${transaction.id}/pdf`,
		backHref: '/admin/sales',
		backLabel: 'Retour aux ventes'
	};
}) satisfies PageServerLoad;
