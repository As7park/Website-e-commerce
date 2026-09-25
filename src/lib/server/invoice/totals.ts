/**
 * Totaux facture — même taux que le checkout, lu depuis
 * `StoreSettings.vatRate` (`$lib/server/vat.ts`) par l'appelant et transmis
 * ici en pourcentage (`vatRatePercent`) : ce module reste une fonction pure
 * synchrone, sans accès Prisma direct.
 *
 * COMMERCE-PLUGIN
 */
const DEFAULT_VAT_RATE_PERCENT = 5.5;

export type InvoiceLineInput = {
	price: number;
	quantity: number;
};

export type InvoiceTotals = {
	subtotalHt: number;
	taxRate: number;
	taxAmount: number;
	shippingCost: number;
	discountAmount: number;
	totalTtc: number;
};

function money2(value: number): number {
	const n = Number.isFinite(value) ? value : 0;
	return Math.round(n * 100) / 100;
}

export function snapshotInvoiceTotals(input: {
	lines: InvoiceLineInput[];
	shippingCost: number;
	discountAmount?: number;
	paidTotal?: number;
	/** Taux de TVA en pourcentage (ex. 20 pour 20 %) — repli sur l'ancien taux fixe si omis. */
	vatRatePercent?: number;
}): InvoiceTotals {
	const vatRatePercent = input.vatRatePercent ?? DEFAULT_VAT_RATE_PERCENT;
	const subtotalHt = money2(
		input.lines.reduce((sum, line) => sum + money2(line.price) * Math.max(0, line.quantity), 0)
	);
	const taxAmount = money2(subtotalHt * (vatRatePercent / 100));
	const shippingCost = money2(input.shippingCost);
	const discountAmount = money2(Math.max(0, input.discountAmount ?? 0));
	const computedTtc = money2(subtotalHt + taxAmount + shippingCost - discountAmount);
	const totalTtc = input.paidTotal != null ? money2(input.paidTotal) : computedTtc;

	return {
		subtotalHt,
		taxRate: vatRatePercent,
		taxAmount,
		shippingCost,
		discountAmount,
		totalTtc
	};
}
