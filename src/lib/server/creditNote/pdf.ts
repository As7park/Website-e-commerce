/**
 * PDF avoir — même moteur que la facture (`$lib/server/invoice/pdf.ts`),
 * montant affiché en négatif pour ne jamais être confondu avec une facture.
 *
 * COMMERCE-PLUGIN
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatMoney } from '$lib/utils/formatMoney';
import type { CreditNoteView } from '$lib/creditNote/types';

function money(amount: number, currency: string): string {
	return formatMoney(amount, currency);
}

export function renderCreditNotePdf(creditNote: CreditNoteView): Buffer {
	const doc = new jsPDF();
	const { company } = creditNote;

	doc.setFontSize(16);
	doc.setFont('helvetica', 'bold');
	doc.text('AVOIR', 105, 20, { align: 'center' });

	doc.setFontSize(10);
	doc.setFont('helvetica', 'normal');
	doc.text(company.name, 14, 40);
	doc.text(company.address, 14, 46);
	doc.text(company.city, 14, 52);
	doc.text(`Tél: ${company.phone}`, 14, 58);
	doc.text(`Email: ${company.email}`, 14, 64);
	doc.text(`TVA: ${company.vat}`, 14, 70);

	doc.text('Émis à :', 130, 40);
	doc.text(creditNote.customerName, 130, 46);
	creditNote.addressLines.forEach((line, index) => {
		doc.text(line, 130, 52 + index * 6);
	});

	doc.setFontSize(12);
	const issued = new Date(creditNote.issuedAt).toLocaleString('fr-FR');
	doc.text(`Numéro d'avoir: ${creditNote.number}`, 14, 90);
	doc.text(`Facture d'origine: ${creditNote.relatedInvoiceNumber}`, 14, 96);
	doc.text(`Date d'émission: ${issued}`, 14, 102);
	doc.text(`Motif: ${creditNote.reasonLabel}`, 14, 108);

	autoTable(doc, {
		startY: 118,
		head: [['Produit', 'Prix unitaire', 'Quantité', 'Total']],
		body:
			creditNote.lines.length > 0
				? creditNote.lines.map((line) => [
						line.name,
						money(line.unitPrice, creditNote.currency),
						String(line.quantity),
						money(line.lineTotal, creditNote.currency)
					])
				: [['—', '—', '—', '—']],
		styles: { fontSize: 10, cellPadding: 2 },
		headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] }
	});

	const lastTable = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable;
	const finalY = (lastTable?.finalY ?? 130) + 15;
	const titleX = 110;
	const valueX = 190;

	doc.setFontSize(12);
	doc.setFont('helvetica', 'bold');
	doc.text('Total avoir:', titleX, finalY);
	doc.setFont('helvetica', 'normal');
	doc.text(`-${money(creditNote.amount, creditNote.currency)}`, valueX, finalY, { align: 'right' });

	doc.setFontSize(10);
	doc.setFont('helvetica', 'italic');
	doc.text('Document généré automatiquement, sans signature manuscrite.', 105, finalY + 16, {
		align: 'center'
	});

	return Buffer.from(doc.output('arraybuffer'));
}
