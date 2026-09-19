import { describe, expect, it } from 'vitest';
import { isDummySecret } from '$lib/server/dummy-secrets';
import { validateSendcloudReturn } from './returnValidate';

/**
 * Test réel (réseau, pas de mock) contre le vrai compte Sendcloud — aucun
 * bac à sable n'existe chez Sendcloud, mais `/api/v3/returns/validate` est
 * un dry-run documenté : aucun enregistrement créé, aucun coût. S'exécute
 * seulement si de vraies clés Sendcloud sont configurées (`.env`/`.env.test`),
 * sinon `describe.skipIf` passe instantanément — jamais bloquant en CI sans
 * ces clés.
 *
 * Ce test n'attend PAS un retour « valide » de bout en bout : la découverte
 * en conditions réelles (voir `returnValidate.ts`) est que ce compte
 * Sendcloud ne semble avoir aucun produit d'expédition activé pour les
 * retours, ni l'option gratuite de test ni un vrai transporteur — Sendcloud
 * répond systématiquement « No shipping methods for given parameters ». Ce
 * test vérifie la chose qui compte réellement à ce stade : que les deux
 * adresses (client + boutique) sont acceptées sans la moindre erreur de
 * champ, preuve que `returnLabel.ts` construit une adresse bien formée même
 * si la création réelle d'étiquette de retour reste à activer côté panneau
 * Sendcloud avant la mise en production.
 */
const live =
	!isDummySecret(process.env.SENDCLOUD_PUBLIC_KEY) &&
	!isDummySecret(process.env.SENDCLOUD_SECRET_KEY) &&
	!isDummySecret(process.env.SENDCLOUD_INTEGRATION_ID);

describe.skipIf(!live)('validateSendcloudReturn — Sendcloud réel (dry-run)', () => {
	it("l'adresse client et l'adresse boutique sont acceptées sans erreur de champ", async () => {
		const result = await validateSendcloudReturn({
			fromAddress: {
				name: 'E2E Test Client',
				address_line_1: '10 Rue de la Paix',
				postal_code: '75002',
				city: 'Paris',
				country_code: 'FR'
			},
			weightKg: 0.5,
			// Un vrai code transporteur (pas l'option gratuite, refusée pour les
			// retours) — le but ici n'est pas que ce produit soit disponible,
			// seulement que les adresses ne déclenchent aucune erreur de champ.
			shippingProductCode: 'colissimo:home/fr'
		});

		expect(result.addressesAccepted).toBe(true);
		expect(
			result.fieldErrors.some((e) => e.field === 'from_address' || e.field === 'to_address')
		).toBe(false);
	});
});
