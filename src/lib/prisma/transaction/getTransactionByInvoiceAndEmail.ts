/**
 * Suivi de commande sans compte — `/suivi-commande` (public, non authentifié).
 *
 * COMMERCE-PLUGIN : les deux critères sont requis ensemble (l'email seul
 * permettrait de lister les commandes d'un tiers). L'email est comparé
 * insensible à la casse, le numéro de facture est déjà un identifiant
 * exact généré par l'app (pas de recherche floue).
 */
import { prisma } from '$lib/server';

export async function getTransactionByInvoiceAndEmail(invoiceNumber: string, email: string) {
	return prisma.transaction.findFirst({
		where: {
			invoiceNumber,
			customer_details_email: { equals: email, mode: 'insensitive' }
		}
	});
}
