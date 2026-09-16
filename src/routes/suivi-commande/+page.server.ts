import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getTransactionByInvoiceAndEmail } from '$lib/prisma/transaction/getTransactionByInvoiceAndEmail';
import { getClientIP, guestTrackingLimiter } from '$lib/server/rate-limit';

/**
 * Suivi de commande sans compte — email + numéro de facture, aucune session
 * requise. Complète `/auth/settings/factures` (réservé aux comptes) pour un
 * achat en invité.
 *
 * COMMERCE-PLUGIN : lecture seule, les deux critères combinés (jamais l'un
 * seul) évitent qu'un numéro de facture — identifiant court et prévisible —
 * suffise à retrouver l'email d'un tiers.
 */
export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const ip = getClientIP(event);
		if (!(await guestTrackingLimiter.consume(ip, 1))) {
			return fail(429, { message: 'Trop de tentatives, réessayez dans un instant.' });
		}

		const formData = await event.request.formData();
		const invoiceNumber = String(formData.get('invoiceNumber') ?? '').trim();
		const email = String(formData.get('email') ?? '').trim();

		if (!invoiceNumber || !email) {
			return fail(400, { message: 'Numéro de facture et email requis.' });
		}

		const transaction = await getTransactionByInvoiceAndEmail(invoiceNumber, email);
		if (!transaction) {
			// Message volontairement générique : ne pas distinguer « email
			// inconnu » de « facture inconnue », ça faciliterait l'énumération.
			return fail(404, { message: 'Aucune commande ne correspond à ces informations.' });
		}

		return {
			success: true,
			tracking: {
				invoiceNumber: transaction.invoiceNumber,
				status: transaction.status,
				shippingMethodName: transaction.shippingMethodName,
				trackingNumber: transaction.trackingNumber,
				trackingUrl: transaction.trackingUrl,
				servicePointId: transaction.servicePointId,
				shippingStatusMessage: transaction.shippingStatusMessage
			}
		};
	}
};
