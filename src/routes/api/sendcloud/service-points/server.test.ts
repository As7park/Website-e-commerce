import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Même intention que `shipping-options/+server.test.ts` : avant ce
 * correctif, aucun timeout n'existait ici (une réponse Sendcloud qui traîne
 * bloquait la requête indéfiniment) et la vraie cause d'erreur était avalée
 * dans un 500 générique.
 */

const validBody = { to_country_code: 'FR', to_postal_code: '75001' };

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

describe('POST /api/sendcloud/service-points — résilience réseau', () => {
	it('renvoie 504 (pas un blocage indéfini) sur un abort/timeout', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((_url: string, init: RequestInit) => {
				return new Promise((_resolve, reject) => {
					init.signal?.addEventListener('abort', () => {
						reject(new DOMException('aborted', 'AbortError'));
					});
				});
			})
		);

		const { POST } = await import('./+server');
		try {
			// @ts-expect-error minimal fake RequestEvent
			await POST({ request: fakeRequest(validBody) });
			expect.unreachable('devait lever une erreur');
		} catch (err) {
			expect(isHttpError(err)).toBe(true);
			if (isHttpError(err)) {
				expect(err.status).toBe(504);
			}
		}
	}, 15_000);

	it("ne renvoie jamais le texte brut de l'erreur Sendcloud au client sur une 5xx", async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 502,
				text: async () => 'secret internal Sendcloud account details'
			})
		);

		const { POST } = await import('./+server');
		try {
			// @ts-expect-error minimal fake RequestEvent
			await POST({ request: fakeRequest(validBody) });
			expect.unreachable('devait lever une erreur');
		} catch (err) {
			expect(isHttpError(err)).toBe(true);
			if (isHttpError(err)) {
				expect(err.status).toBe(502);
				expect(err.body.message).not.toContain('secret internal Sendcloud');
			}
		}
	});

	it('renvoie un corps de requête invalide en 400 (jamais un throw non géré)', async () => {
		const { POST } = await import('./+server');
		// @ts-expect-error minimal fake RequestEvent
		const response = await POST({ request: fakeRequest({ to_country_code: 'FR' }) });
		expect(response.status).toBe(400);
	});
});
