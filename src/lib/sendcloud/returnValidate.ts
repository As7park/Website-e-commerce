/**
 * Validation d'un retour Sendcloud (API v3, dry-run) — vérifie que
 * l'adresse/le payload d'un retour seraient acceptés, SANS jamais créer le
 * retour ni le transmettre à un transporteur (endpoint documenté par
 * Sendcloud comme un pur contrôle, aucun enregistrement ni coût).
 *
 * Sert uniquement à vérifier que les données d'adresse que
 * `$lib/sendcloud/returnLabel.ts` construit à l'aveugle aujourd'hui (adresse
 * de retour de la boutique, via les mêmes variables d'environnement) sont
 * réellement bien formées côté Sendcloud — pas encore branché sur le vrai
 * flux d'approbation de retour (`/admin/returns`), qui reste en v2 tant que
 * le choix commercial du transporteur de retour n'est pas tranché (voir
 * docs/commerce/README.md).
 *
 * Découverte en conditions réelles (voir `returnValidate.test.ts`) : le
 * champ `ship_with` de CET endpoint attend `shipping_product_code`, pas
 * `shipping_option_code` (vocabulaire différent de l'envoi aller,
 * `label.ts`). Découverte plus importante encore : aucun produit
 * d'expédition testé (ni l'option gratuite « lettre non affranchie », ni un
 * code transporteur réel comme `colissimo:home/fr`) n'a été accepté par cet
 * endpoint pour ce compte — Sendcloud répond systématiquement
 * `"No shipping methods for given parameters"`. Cela ressemble à une
 * capacité de retour non configurée au niveau du compte/contrat
 * transporteur chez Sendcloud, pas à un bug de payload : l'adresse elle-même
 * est acceptée (aucune erreur de champ), seule la disponibilité d'une
 * méthode de retour est refusée. À vérifier/activer côté panneau Sendcloud
 * avant qu'un retour (v2 ou v3) puisse fonctionner en production.
 */

function envOr(name: string, fallback: string): string {
	const value = process.env[name]?.trim();
	return value && value.length > 0 ? value : fallback;
}

function authHeader(): string {
	const pub = process.env.SENDCLOUD_PUBLIC_KEY;
	const sec = process.env.SENDCLOUD_SECRET_KEY;
	if (!pub || !sec) throw new Error('Sendcloud credentials missing');
	return 'Basic ' + Buffer.from(`${pub}:${sec}`).toString('base64');
}

/** Adresse boutique de retour — mêmes variables d'environnement que `returnLabel.ts`. */
function shopToAddress() {
	return {
		name: envOr('INVOICE_COMPANY_NAME', 'MadeInDiamonds'),
		address_line_1: envOr('INVOICE_COMPANY_ADDRESS', '123 Rue des Affaires'),
		house_number: envOr('SENDCLOUD_RETURN_HOUSE_NUMBER', '') || undefined,
		postal_code: envOr('SENDCLOUD_RETURN_POSTAL_CODE', '75000'),
		city: envOr('SENDCLOUD_RETURN_CITY', 'Paris'),
		country_code: envOr('SENDCLOUD_RETURN_COUNTRY', 'FR'),
		email: envOr('INVOICE_COMPANY_EMAIL', 'contact@madeindiamonds.com'),
		phone_number: envOr('INVOICE_COMPANY_PHONE', '+33123456789')
	};
}

export interface ReturnValidateInput {
	/** Adresse du client, point de départ du retour. */
	fromAddress: {
		name: string;
		address_line_1: string;
		postal_code: string;
		city: string;
		country_code: string;
	};
	weightKg: number;
	/**
	 * Aucun choix commercial de transporteur de retour n'existe encore (voir
	 * questions ouvertes, docs/commerce/README.md) — fourni par l'appelant,
	 * jamais deviné ici. Attention : `sendcloud:letter` (l'option gratuite
	 * utilisée pour les tests d'envoi aller) est refusée pour un retour,
	 * confirmé en conditions réelles — voir le commentaire d'en-tête.
	 */
	shippingProductCode: string;
}

export interface ReturnValidateResult {
	valid: boolean;
	/** `true` si Sendcloud n'a signalé aucun problème sur les deux adresses. */
	addressesAccepted: boolean;
	/** Détail Sendcloud (code + message) de chaque erreur de champ renvoyée. */
	fieldErrors: Array<{ field?: string; message?: string }>;
	raw: unknown;
}

type SendcloudReturnValidateError = { field?: string; message?: string; detail?: string };
type SendcloudReturnValidateResponse = { errors?: SendcloudReturnValidateError[] };

export async function validateSendcloudReturn(
	input: ReturnValidateInput
): Promise<ReturnValidateResult> {
	const requestBody = {
		from_address: input.fromAddress,
		to_address: shopToAddress(),
		ship_with: { shipping_product_code: input.shippingProductCode },
		weight: { value: input.weightKg, unit: 'kg' }
	};

	const response = await fetch('https://panel.sendcloud.sc/api/v3/returns/validate', {
		method: 'POST',
		headers: {
			Authorization: authHeader(),
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		body: JSON.stringify(requestBody)
	});

	const raw: SendcloudReturnValidateResponse = await response.json().catch(() => ({}));
	const errors: SendcloudReturnValidateError[] = Array.isArray(raw?.errors) ? raw.errors : [];
	const fieldErrors = errors.map((e) => ({ field: e?.field, message: e?.message ?? e?.detail }));

	// Une erreur sur `from_address`/`to_address` signale un vrai problème
	// d'adresse ; une erreur sur `returns`/`ship_with` (aucune méthode
	// disponible pour ces paramètres) est une limite de compte/contrat
	// transporteur, pas un problème de payload — les deux sont distingués
	// plutôt que traités comme un échec unique et opaque.
	const addressesAccepted = !fieldErrors.some(
		(e) => e.field === 'from_address' || e.field === 'to_address'
	);

	if (!response.ok && !addressesAccepted) {
		const detail =
			fieldErrors.map((e) => `${e.field}: ${e.message}`).join('; ') || JSON.stringify(raw);
		throw new Error(`Sendcloud a rejeté l'adresse du retour : ${detail}`);
	}

	return {
		valid: response.ok,
		addressesAccepted,
		fieldErrors,
		raw
	};
}
