/**
 * Instantané d'affichage d'un avoir — construit à partir de la même
 * `InvoiceSource` que la facture d'origine (`$lib/server/invoice/view.ts`),
 * jamais un modèle séparé : l'avoir annule/complète la facture, il en
 * reprend les lignes et le montant.
 *
 * COMMERCE-PLUGIN
 */
import { buildInvoiceView, type InvoiceSource } from '../invoice/view';
import type { InvoiceCompany } from '$lib/invoice/types';
import type { CreditNoteReason, CreditNoteView } from '$lib/creditNote/types';

const REASON_LABELS: Record<CreditNoteReason, string> = {
	REFUND: 'Remboursement Stripe',
	STORE_CREDIT: 'Crédit compte (carte cadeau)'
};

export function buildCreditNoteView(
	source: InvoiceSource,
	number: string,
	reason: CreditNoteReason,
	company: InvoiceCompany
): CreditNoteView {
	const invoice = buildInvoiceView(source, company);

	return {
		id: source.id,
		number,
		issuedAt: new Date().toISOString(),
		relatedInvoiceNumber: invoice.number,
		customerName: invoice.customerName,
		customerEmail: invoice.customerEmail,
		addressLines: invoice.addressLines,
		lines: invoice.lines,
		// Remboursement/crédit toujours intégral (voir la route admin) : le
		// montant de l'avoir est celui de la facture d'origine.
		amount: invoice.totalTtc,
		currency: invoice.currency,
		reason,
		reasonLabel: REASON_LABELS[reason],
		filename: `Avoir_${number}.pdf`,
		company: invoice.company
	};
}
