/**
 * Étiquette de retour Sendcloud — trajet inverse de `createSendcloudLabel`
 * (`$lib/sendcloud/label.ts`) : le colis part du domicile client pour
 * revenir à l'atelier, l'adresse de livraison du parcel est donc la nôtre,
 * pas celle du client.
 *
 * COMMERCE-PLUGIN : appelée uniquement depuis l'approbation d'un retour
 * (`/admin/returns`), en best-effort — un échec ici ne doit jamais bloquer
 * le remboursement Stripe, déjà la partie qui compte financièrement. Le
 * champ `is_return` n'a pas été vérifié contre un compte Sendcloud réel
 * dans cet environnement (pas de sandbox disponible) : à valider une fois
 * avant la première utilisation en production, comme `label.ts` le fait
 * déjà pour l'envoi aller.
 */
import { prisma } from '$lib/server';

function envOr(name: string, fallback: string): string {
	const value = process.env[name]?.trim();
	return value && value.length > 0 ? value : fallback;
}

export interface ReturnLabelResult {
	trackingNumber: string | null;
	trackingUrl: string | null;
}

interface TransactionForReturn {
	shippingMethodId: number;
	package_weight: number;
}

export async function createSendcloudReturnLabel(
	returnRequestId: string,
	transaction: TransactionForReturn
): Promise<ReturnLabelResult> {
	const authString = `${process.env.SENDCLOUD_PUBLIC_KEY}:${process.env.SENDCLOUD_SECRET_KEY}`;
	const base64Auth = Buffer.from(authString).toString('base64');

	const requestBody = {
		parcels: [
			{
				// Destination du colis retour : l'atelier, jamais le client.
				name: envOr('INVOICE_COMPANY_NAME', 'MadeInDiamonds'),
				address: envOr('INVOICE_COMPANY_ADDRESS', '123 Rue des Affaires'),
				house_number: envOr('SENDCLOUD_RETURN_HOUSE_NUMBER', ''),
				city: envOr('SENDCLOUD_RETURN_CITY', 'Paris'),
				postal_code: envOr('SENDCLOUD_RETURN_POSTAL_CODE', '75000'),
				country: envOr('SENDCLOUD_RETURN_COUNTRY', 'FR'),
				email: envOr('INVOICE_COMPANY_EMAIL', 'contact@madeindiamonds.com'),
				telephone: envOr('INVOICE_COMPANY_PHONE', '+33123456789'),
				shipment: { id: transaction.shippingMethodId || 413 },
				weight: (transaction.package_weight || 1).toString(),
				request_label: true,
				is_return: true
			}
		]
	};

	const response = await fetch('https://panel.sendcloud.sc/api/v2/parcels', {
		method: 'POST',
		headers: {
			Authorization: `Basic ${base64Auth}`,
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const detail = await response.text().catch(() => '');
		throw new Error(`Sendcloud a refusé la création de l'étiquette de retour : ${detail}`);
	}

	const responseData = await response.json();
	const [parcel] = responseData.parcels ?? [];
	if (!parcel) {
		throw new Error('Réponse Sendcloud sans colis pour la création de l’étiquette de retour.');
	}

	const trackingNumber: string | null = parcel.tracking_number ?? null;
	const trackingUrl: string | null = parcel.label?.label_printer_url ?? parcel.label_url ?? null;

	await prisma.returnRequest.update({
		where: { id: returnRequestId },
		data: { returnTrackingNumber: trackingNumber, returnTrackingUrl: trackingUrl }
	});

	return { trackingNumber, trackingUrl };
}
