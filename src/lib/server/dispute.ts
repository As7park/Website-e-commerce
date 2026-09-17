/**
 * Statuts de litige Stripe (`Transaction.disputeStatus`) — mêmes valeurs que
 * `Dispute.status` de l'API Stripe, jamais réinterprétées, juste traduites
 * pour l'affichage admin (`/admin/sales`) et l'alerte e-mail.
 */
export const DISPUTE_STATUS_LABELS: Record<string, string> = {
	warning_needs_response: 'Avertissement — réponse possible',
	warning_under_review: 'Avertissement — en cours de revue',
	warning_closed: 'Avertissement clos',
	needs_response: 'Litige — réponse requise',
	under_review: 'Litige en cours de revue',
	charge_refunded: 'Remboursé suite au litige',
	won: 'Litige gagné',
	lost: 'Litige perdu'
};

export function formatDisputeStatus(status: string): string {
	return DISPUTE_STATUS_LABELS[status] ?? status;
}
