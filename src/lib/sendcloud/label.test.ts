import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Vérifie la forme du payload v3 envoyé, que chaque échec lève une exception
 * (jamais un `return` silencieux — le bug confirmé sur l'ancien code v2, qui
 * laissait une transaction payée sans étiquette pour toujours sans aucune
 * alerte), et que la bonne donnée est écrite en base sur succès. Réseau
 * entièrement mocké, aucun appel réel à Sendcloud.
 */

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

const baseTransaction = {
	id: 'tx_label_test',
	shippingOption: 'colissimo:home',
	address_first_name: 'Jeanne',
	address_last_name: 'Dupont',
	address_phone: '0600000000',
	address_company: null,
	address_street_number: '12',
	address_street: 'Rue des Tests',
	address_city: 'Montauban',
	address_zip: '82000',
	address_country_code: 'FR',
	customer_details_email: 'jeanne@example.test',
	package_length: 30,
	package_width: 20,
	package_height: 15,
	package_weight: 1.2,
	servicePointId: null
};

const v3SuccessResponse = {
	id: 'shipment-uuid-1',
	parcels: [
		{
			id: 987654,
			status: { code: 'READY_TO_SEND', message: 'Ready to send' },
			tracking_number: 'TRACK123'
		}
	],
	tracking_number: 'TRACK123',
	documents: [{ type: 'label', link: 'https://panel.sendcloud.sc/label/987654.pdf' }]
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubEnv('SENDCLOUD_PUBLIC_KEY', 'test-public');
	vi.stubEnv('SENDCLOUD_SECRET_KEY', 'test-secret');
	transactionFindUnique.mockResolvedValue({ id: baseTransaction.id });
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe('createSendcloudLabel', () => {
	it('ne fait rien pour une commande sur-mesure (no_shipping)', async () => {
		vi.stubGlobal('fetch', vi.fn());
		const { createSendcloudLabel } = await import('./label');

		await createSendcloudLabel({ ...baseTransaction, shippingOption: 'no_shipping' });

		expect(fetch).not.toHaveBeenCalled();
		expect(transactionUpdate).not.toHaveBeenCalled();
	});

	it("lève une exception si une donnée d'adresse obligatoire manque, sans appeler Sendcloud", async () => {
		vi.stubGlobal('fetch', vi.fn());
		const { createSendcloudLabel } = await import('./label');

		await expect(
			createSendcloudLabel({ ...baseTransaction, address_city: '' })
		).rejects.toThrow(/adresse/i);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('envoie le shipping_option_code du checkout, sans second appel réseau de résolution', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => v3SuccessResponse
		});
		vi.stubGlobal('fetch', mockFetch);
		const { createSendcloudLabel } = await import('./label');

		await createSendcloudLabel(baseTransaction);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toBe('https://panel.sendcloud.sc/api/v3/shipments/announce');
		const body = JSON.parse((init as RequestInit).body as string);
		expect(body.ship_with).toEqual({
			type: 'shipping_option_code',
			properties: { shipping_option_code: 'colissimo:home' }
		});
		expect(body.to_address.city).toBe('Montauban');
		expect(body.parcels[0].weight).toEqual({ value: 1.2, unit: 'kg' });
	});

	it('pose parcelId/trackingNumber/trackingUrl en base sur succès', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: async () => v3SuccessResponse })
		);
		const { createSendcloudLabel } = await import('./label');

		await createSendcloudLabel(baseTransaction);

		expect(transactionUpdate).toHaveBeenCalledWith({
			where: { id: baseTransaction.id },
			data: {
				sendcloudParcelId: 987654,
				trackingNumber: 'TRACK123',
				trackingUrl: 'https://panel.sendcloud.sc/label/987654.pdf'
			}
		});
	});

	it('lève une exception (ne renvoie jamais silencieusement) sur une réponse HTTP en échec', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 422,
				json: async () => ({ errors: [{ detail: 'Invalid postal code' }] })
			})
		);
		const { createSendcloudLabel } = await import('./label');

		await expect(createSendcloudLabel(baseTransaction)).rejects.toThrow(/Invalid postal code/);
		expect(transactionUpdate).not.toHaveBeenCalled();
	});

	it("lève une exception si Sendcloud refuse l'annonce du colis malgré un 2xx", async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					...v3SuccessResponse,
					parcels: [{ id: 1, status: { code: 'ANNOUNCEMENT_FAILED', message: 'Carrier refused' } }]
				})
			})
		);
		const { createSendcloudLabel } = await import('./label');

		await expect(createSendcloudLabel(baseTransaction)).rejects.toThrow(/Carrier refused/);
		expect(transactionUpdate).not.toHaveBeenCalled();
	});
});
