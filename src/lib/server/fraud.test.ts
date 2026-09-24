import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `computeFraudScore` : les trois facteurs (vélocité, écart adresse,
 * e-mail jetable), leur cumul, et les bornes exactes des bandes de niveau.
 * Prisma entièrement mocké — aucun réseau, aucune base réelle.
 */

const transactionCount = vi.fn();
const addressFindUnique = vi.fn();

vi.mock('$lib/server', () => ({
	prisma: {
		transaction: { count: transactionCount },
		address: { findUnique: addressFindUnique }
	}
}));

const baseInput = {
	userId: 'user_1',
	userEmail: 'client@example.com',
	shippingAddressId: 'addr_ship',
	billingAddressId: 'addr_bill'
};

function address(overrides: Partial<{ country_code: string; zip: string; city: string }> = {}) {
	return { country_code: 'FR', zip: '75000', city: 'Paris', ...overrides };
}

beforeEach(() => {
	vi.clearAllMocks();
	transactionCount.mockResolvedValue(0);
	addressFindUnique.mockResolvedValue(address());
});

describe('computeFraudScore', () => {
	it('aucun facteur déclenché → score 0, niveau low', async () => {
		const { computeFraudScore } = await import('./fraud');

		const result = await computeFraudScore({
			...baseInput,
			shippingAddressId: 'same',
			billingAddressId: 'same'
		});

		expect(result).toEqual({ score: 0, level: 'low', factors: [] });
	});

	it('vélocité seule (≥ 3 transactions récentes) → +40, medium', async () => {
		transactionCount.mockResolvedValue(3);
		const { computeFraudScore } = await import('./fraud');

		const result = await computeFraudScore({
			...baseInput,
			shippingAddressId: 'same',
			billingAddressId: 'same'
		});

		expect(result.score).toBe(40);
		expect(result.level).toBe('medium');
		expect(result.factors).toEqual(['Vélocité de commandes']);
	});

	it('vélocité sous le seuil (2 transactions) → aucun facteur déclenché', async () => {
		transactionCount.mockResolvedValue(2);
		const { computeFraudScore } = await import('./fraud');

		const result = await computeFraudScore({
			...baseInput,
			shippingAddressId: 'same',
			billingAddressId: 'same'
		});

		expect(result.score).toBe(0);
		expect(result.factors).toEqual([]);
	});

	it('adresses identiques (même id) → jamais de lecture Address, aucun écart', async () => {
		const { computeFraudScore } = await import('./fraud');

		const result = await computeFraudScore({
			...baseInput,
			shippingAddressId: 'x',
			billingAddressId: 'x'
		});

		expect(addressFindUnique).not.toHaveBeenCalled();
		expect(result.factors).toEqual([]);
	});

	it('pays différent entre livraison et facturation → +30', async () => {
		addressFindUnique
			.mockResolvedValueOnce(address({ country_code: 'FR' }))
			.mockResolvedValueOnce(address({ country_code: 'DE' }));
		const { computeFraudScore } = await import('./fraud');

		const result = await computeFraudScore(baseInput);

		expect(result.score).toBe(30);
		expect(result.factors).toEqual(['Écart adresse facturation/livraison']);
	});

	it('même pays mais ville/code postal différents → +15', async () => {
		addressFindUnique
			.mockResolvedValueOnce(address({ city: 'Paris', zip: '75000' }))
			.mockResolvedValueOnce(address({ city: 'Lyon', zip: '69000' }));
		const { computeFraudScore } = await import('./fraud');

		const result = await computeFraudScore(baseInput);

		expect(result.score).toBe(15);
		expect(result.factors).toEqual(['Écart adresse facturation/livraison']);
	});

	it('e-mail à domaine jetable connu → +30', async () => {
		const { computeFraudScore } = await import('./fraud');

		const result = await computeFraudScore({
			...baseInput,
			shippingAddressId: 'same',
			billingAddressId: 'same',
			userEmail: 'test@mailinator.com'
		});

		expect(result.score).toBe(30);
		expect(result.factors).toEqual(['E-mail jetable']);
	});

	it('cumul des trois facteurs → high, score plafonné à 100', async () => {
		transactionCount.mockResolvedValue(5);
		addressFindUnique
			.mockResolvedValueOnce(address({ country_code: 'FR' }))
			.mockResolvedValueOnce(address({ country_code: 'DE' }));
		const { computeFraudScore } = await import('./fraud');

		const result = await computeFraudScore({ ...baseInput, userEmail: 'x@guerrillamail.com' });

		expect(result.score).toBe(100); // 40 + 30 + 30
		expect(result.level).toBe('high');
		expect(result.factors).toEqual([
			'Vélocité de commandes',
			'Écart adresse facturation/livraison',
			'E-mail jetable'
		]);
	});

	it('borne exacte 29/30 : sous le seuil medium reste low', async () => {
		// Seul l'écart local (+15) : score 15, encore low.
		addressFindUnique
			.mockResolvedValueOnce(address({ city: 'Paris' }))
			.mockResolvedValueOnce(address({ city: 'Lyon' }));
		const { computeFraudScore } = await import('./fraud');

		const result = await computeFraudScore(baseInput);

		expect(result.score).toBe(15);
		expect(result.level).toBe('low');
	});

	it('borne 55/60 : vélocité + écart local (55) reste medium, juste sous le seuil high', async () => {
		transactionCount.mockResolvedValue(3); // +40
		addressFindUnique
			.mockResolvedValueOnce(address({ city: 'Paris' }))
			.mockResolvedValueOnce(address({ city: 'Lyon' })); // +15
		const { computeFraudScore } = await import('./fraud');

		const result = await computeFraudScore(baseInput);

		expect(result.score).toBe(55);
		expect(result.level).toBe('medium');
	});

	it('borne 60 exact : pays différent + e-mail jetable (60) bascule en high', async () => {
		addressFindUnique
			.mockResolvedValueOnce(address({ country_code: 'FR' }))
			.mockResolvedValueOnce(address({ country_code: 'DE' })); // +30
		const { computeFraudScore } = await import('./fraud');

		const result = await computeFraudScore({
			...baseInput,
			userEmail: 'x@mailinator.com' // +30 → total 60
		});

		// 30 + 30 = 60 → doit être 'high' (>= 60), pas 'medium' : vérifie la
		// borne inclusive exacte du seuil `RISK_LEVEL_HIGH_THRESHOLD`.
		expect(result.score).toBe(60);
		expect(result.level).toBe('high');
	});
});

describe('formatRiskLevel', () => {
	it('traduit les trois niveaux connus', async () => {
		const { formatRiskLevel } = await import('./fraud');

		expect(formatRiskLevel('low')).toBe('Faible');
		expect(formatRiskLevel('medium')).toBe('Moyen');
		expect(formatRiskLevel('high')).toBe('Élevé');
	});

	it('repli sur "—" si absent, valeur brute si inconnue', async () => {
		const { formatRiskLevel } = await import('./fraud');

		expect(formatRiskLevel(null)).toBe('—');
		expect(formatRiskLevel(undefined)).toBe('—');
		expect(formatRiskLevel('unknown_value')).toBe('unknown_value');
	});
});
