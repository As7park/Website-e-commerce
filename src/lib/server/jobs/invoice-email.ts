import { prisma } from '$lib/server';
import { withLock } from '$lib/server/lock';
import { sendInvoiceEmail } from '$lib/server/invoice/email';
import { log } from '$lib/server/log';

/**
 * Envoi de la facture, sorti du job Sendcloud (`post-payment.ts`) : un pic de
 * commandes ne doit pas coupler l'envoi SMTP (ses propres limites de débit,
 * voir `$lib/server/invoice/email.ts`) à la disponibilité de Sendcloud, ni
 * l'inverse — chacun a son propre retry QStash indépendant.
 */
export async function runInvoiceEmailJob(transactionId: string): Promise<void> {
	await withLock(`invoice-email:${transactionId}`, 60, async () => {
		const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
		if (!transaction) {
			log('ERROR', 'invoice-email', `Transaction introuvable pour le job facture: ${transactionId}`);
			return;
		}

		if (transaction.status !== 'paid') {
			log(
				'WARN',
				'invoice-email',
				'Statut de paiement non "paid", envoi de facture ignoré. Statut:',
				transaction.status
			);
			return;
		}

		await sendInvoiceEmail(transaction);
		log('INFO', 'invoice-email', 'Facture envoyée', { transactionId });
	});
}
