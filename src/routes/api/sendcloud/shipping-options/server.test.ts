import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Vérifie que l'endpoint ne laisse jamais fuiter une exception non gérée ni
 * le texte brut d'erreur de Sendcloud vers le client — avant ce correctif,
 * aucun `try/catch` n'entourait les deux appels `fetch` (Sendcloud pouvait
 * expirer/tomber en panne sans réponse structurée), et une erreur Sendcloud
 * était renvoyée telle quelle (fuite d'information potentielle).
 */

const validBody = {
	from_country_code: 'FR',
	to_country_code: 'FR',
	from_postal_code: '75001',
	to_postal_code: '75002',
	weight: { value: 1, unit: 'kilogram' },
	dimensions: { length: 10, width: 10, height: 10, unit: 'cm' }
};

function fakeRequest(body: unknown) {
	return { json: async () => body } as Request;
}

function isHttpError(err: unknown): err is { status: number; body: { message: string } } {
	return typeof err === 'object' && err !== null && 'status' in err;
}

beforeEach(() => {
	vi.stubEnv('SENDCLOUD_PUBLIC_KEY', 'test-public');
	vi.stubEnv('SENDCLOUD_SECRET_KEY', 'test-secret');
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe('POST /api/sendcloud/shipping-options — résilience réseau', () => {
	it('renvoie 504 (pas une exception non gérée) sur un abort/timeout', async () => {
		const mockFetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
			return new Promise((_resolve, reject) => {
				init.signal?.addEventListener('abort', () => {
					const abortError = new DOMException('aborted', 'AbortError');
					reject(abortError);
				});
			});
		});

		const { POST } = await import('./+server');
		try {
			// @ts-expect-error minimal fake RequestEvent
			await POST({ request: fakeRequest(validBody), fetch: mockFetch });
			expect.unreachable('devait lever une erreur');
		} catch (err) {
			expect(isHttpError(err)).toBe(true);
			if (isHttpError(err)) {
				expect(err.status).toBe(504);
			}
		}
	}, 15_000);

	it("ne renvoie jamais le texte brut de l'erreur Sendcloud au client sur une 5xx", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			text: async () => 'secret internal Sendcloud account details'
		});

		const { POST } = await import('./+server');
		try {
			// @ts-expect-error minimal fake RequestEvent
			await POST({ request: fakeRequest(validBody), fetch: mockFetch });
			expect.unreachable('devait lever une erreur');
		} catch (err) {
			expect(isHttpError(err)).toBe(true);
			if (isHttpError(err)) {
				expect(err.status).toBe(500);
				expect(err.body.message).not.toContain('secret internal Sendcloud');
			}
		}
	});

	it('renvoie 429 sur une limitation de débit Sendcloud', async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => '' });

		const { POST } = await import('./+server');
		try {
			// @ts-expect-error minimal fake RequestEvent
			await POST({ request: fakeRequest(validBody), fetch: mockFetch });
			expect.unreachable('devait lever une erreur');
		} catch (err) {
			expect(isHttpError(err)).toBe(true);
			if (isHttpError(err)) {
				expect(err.status).toBe(429);
			}
		}
	});
});
