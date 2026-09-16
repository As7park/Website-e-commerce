import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getTransactionByIdForUser } from '$lib/prisma/transaction/getTransactionById';
import { buildInvoiceView } from '$lib/server/invoice/view';

/**
 * Facture du compte.
 *
 * COMMERCE-PLUGIN / AUTH-PLUGIN : uniquement la transaction du visiteur connecté.
 */
export const load = (async ({ params, locals }) => {
	const userId = locals.user?.id;
	if (!userId) {
		throw redirect(302, '/auth/login');
	}

	const transactionId = params.id;
	if (!transactionId) {
		error(400, 'Transaction ID is missing');
	}

	const transaction = await getTransactionByIdForUser(transactionId, userId);
	if (!transaction) {
		error(404, 'Facture introuvable');
	}

	return {
		invoice: buildInvoiceView(transaction),
		pdfHref: `/auth/settings/factures/${transaction.id}/pdf`,
		backHref: '/auth/settings/factures',
		backLabel: 'Retour aux factures',
		tracking: {
			status: transaction.status,
			shippingMethodName: transaction.shippingMethodName,
			trackingNumber: transaction.trackingNumber,
			trackingUrl: transaction.trackingUrl,
			servicePointId: transaction.servicePointId,
			shippingStatusMessage: transaction.shippingStatusMessage
		}
	};
}) satisfies PageServerLoad;
