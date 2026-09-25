import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTransactionByIdForUser } from '$lib/prisma/transaction/getTransactionById';
import { getReturnRequestByTransactionId } from '$lib/prisma/returns/returns';
import { pdfDownloadResponse } from '$lib/server/invoice/http';
import { renderCreditNotePdf } from '$lib/server/creditNote/pdf';
import { buildCreditNoteView } from '$lib/server/creditNote/view';
import { getInvoiceCompany } from '$lib/server/invoice/company';

/**
 * Téléchargement PDF — avoir du visiteur connecté, une fois son retour
 * remboursé (Stripe) ou crédité (carte cadeau).
 *
 * COMMERCE-PLUGIN / AUTH-PLUGIN
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = locals.user?.id;
	if (!userId) {
		throw redirect(302, '/auth/login');
	}

	const transactionId = params.transactionId;
	if (!transactionId) {
		error(400, 'Transaction ID is missing');
	}

	const transaction = await getTransactionByIdForUser(transactionId, userId);
	if (!transaction) {
		error(404, 'Facture introuvable');
	}

	const returnRequest = await getReturnRequestByTransactionId(transactionId);
	if (!returnRequest?.creditNoteNumber) {
		error(404, 'Avoir introuvable');
	}

	const reason = returnRequest.status === 'CREDITED' ? 'STORE_CREDIT' : 'REFUND';
	const creditNote = buildCreditNoteView(
		transaction,
		returnRequest.creditNoteNumber,
		reason,
		await getInvoiceCompany()
	);
	return pdfDownloadResponse(await renderCreditNotePdf(creditNote), creditNote.filename);
};
