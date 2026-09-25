/**
 * Identité vendeur imprimée sur la facture.
 *
 * COMMERCE-PLUGIN : priorité à l'identité saisie depuis `/admin/identite`
 * (`$lib/server/companyIdentity.ts`) ; repli sur `INVOICE_COMPANY_*` (env)
 * pour ne rien changer aux déploiements existants qui les utilisaient déjà ;
 * repli final sur des valeurs manifestement fictives, jamais confondues
 * avec une vraie identité d'entreprise. `logoUrl` n'a pas de repli : jamais
 * de logo inventé, `null` tant qu'il n'est pas envoyé depuis l'admin.
 */
import type { InvoiceCompany } from '$lib/invoice/types';
import { getCompanyIdentity } from '$lib/server/companyIdentity';

export type { InvoiceCompany };

function envOr(name: string, fallback: string): string {
	const value = process.env[name]?.trim();
	return value && value.length > 0 ? value : fallback;
}

export async function getInvoiceCompany(): Promise<InvoiceCompany> {
	const identity = await getCompanyIdentity();
	return {
		name: identity.name || envOr('INVOICE_COMPANY_NAME', 'MadeInDiamonds'),
		address: identity.address || envOr('INVOICE_COMPANY_ADDRESS', '123 Rue des Affaires'),
		city: identity.city || envOr('INVOICE_COMPANY_CITY', '75000 Paris, France'),
		phone: identity.phone || envOr('INVOICE_COMPANY_PHONE', '+33 1 23 45 67 89'),
		email: identity.email || envOr('INVOICE_COMPANY_EMAIL', 'contact@madeindiamonds.com'),
		vat: identity.vatNumber || envOr('INVOICE_COMPANY_VAT', 'FR123456789'),
		siret: identity.siret || envOr('INVOICE_COMPANY_SIRET', '000 000 000 00000'),
		logoUrl: identity.logoUrl
	};
}
