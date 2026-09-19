import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isDummySecret } from '$lib/server/dummy-secrets';

/**
 * Test réel (réseau, pas de mock) : exécute le vrai `createSendcloudLabel`
 * (code v3 migré) contre le vrai compte Sendcloud, avec l'option gratuite
 * « lettre non affranchie » (`sendcloud:letter`) — aucun bac à sable
 * n'existe chez Sendcloud, mais cette option crée un vrai enregistrement
 * jamais facturé (voir docs/commerce/README.md, section « Tests Sendcloud
 * réels »). Seule la base de données est mockée : c'est le seul test de
 * cette suite qui exerce le vrai appel HTTP du code migré, pas une
 * réimplémentation de sa forme (contrairement à `label.test.ts`, mocké).
 *
 * S'exécute seulement si de vraies clés Sendcloud sont configurées dans
 * l'environnement du process (`.env`/`.env.test`, ex. via `source .env`
 * avant `npm run test:unit` — Vitest ne charge pas `process.env` tout seul),
 * sinon `describe.skipIf` passe instantanément, jamais bloquant en CI sans
 * ces clés.
 */
const live =
	!isDummySecret(process.env.SENDCLOUD_PUBLIC_KEY) &&
	!isDummySecret(process.env.SENDCLOUD_SECRET_KEY) &&
	!isDummySecret(process.env.SENDCLOUD_INTEGRATION_ID);

const transactionUpdate = vi.fn();
const transactionFindUnique = vi.fn();

vi.mock('$lib/server', () => ({
	prisma: {
		transaction: {
			findUnique: transactionFindUnique,
			update: transactionUpdate
		}
	}
}));

beforeEach(() => {
	vi.clearAllMocks();
	transactionFindUnique.mockResolvedValue({ id: 'tx_live_test' });
});

describe.skipIf(!live)('createSendcloudLabel — Sendcloud réel (lettre non affranchie)', () => {
	it('crée une vraie étiquette gratuite et pose parcelId/tracking en base', async () => {
		const { createSendcloudLabel } = await import('./label');

		await createSendcloudLabel({
			id: 'tx_live_test',
			shippingOption: 'sendcloud:letter',
			address_first_name: 'E2E',
			address_last_name: 'Live Test',
			address_phone: '0600000000',
			address_company: null,
			address_street_number: '10',
			address_street: 'Rue de la Paix',
			address_city: 'Paris',
			address_zip: '75002',
			address_country_code: 'FR',
			customer_details_email: null,
			package_length: 20,
			package_width: 15,
			package_height: 2,
			package_weight: 0.05,
			servicePointId: null
		});

		expect(transactionUpdate).toHaveBeenCalledTimes(1);
		const [call] = transactionUpdate.mock.calls;
		const data = call[0].data;
		expect(data.sendcloudParcelId).toEqual(expect.any(Number));
		expect(data.trackingNumber).toBeTruthy();
	}, 30_000);
});
