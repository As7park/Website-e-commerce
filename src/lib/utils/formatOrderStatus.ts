/**
 * Libellé lisible pour `Transaction.status` (valeur brute Stripe :
 * `payment_status` d'une Checkout Session — `paid`, `unpaid`,
 * `no_payment_required`).
 */
export type OrderStatusTone = 'success' | 'pending' | 'muted';

export interface OrderStatusLabel {
	label: string;
	tone: OrderStatusTone;
}

const STATUS_LABELS: Record<string, OrderStatusLabel> = {
	paid: { label: 'Payée', tone: 'success' },
	unpaid: { label: 'En attente de paiement', tone: 'pending' },
	no_payment_required: { label: 'Aucun paiement requis', tone: 'muted' }
};

export function formatOrderStatus(status: string): OrderStatusLabel {
	return STATUS_LABELS[status] ?? { label: status, tone: 'muted' };
}
