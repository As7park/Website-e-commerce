import type { InvoiceCompany, InvoiceLine } from '$lib/invoice/types';

export type CreditNoteReason = 'REFUND' | 'STORE_CREDIT';

/** Forme sérialisée d'un avoir (aperçu + PDF), lié à la facture d'origine. */
export type CreditNoteView = {
	id: string;
	number: string;
	issuedAt: string;
	relatedInvoiceNumber: string;
	customerName: string;
	customerEmail: string;
	addressLines: string[];
	lines: InvoiceLine[];
	amount: number;
	currency: string;
	reason: CreditNoteReason;
	reasonLabel: string;
	filename: string;
	company: InvoiceCompany;
};
