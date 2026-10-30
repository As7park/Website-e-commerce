import { describe, expect, it, vi } from 'vitest';
import { deleteAuthCookie, readAuthCookie, SESSION_COOKIE } from './cookies';

function jar(values: Record<string, string>) {
	return {
		get: (name: string) => values[name],
		delete: vi.fn()
	} as unknown as Parameters<typeof readAuthCookie>[0];
}

describe('cookies Better Auth', () => {
	it('lit le cookie préfixé __Secure- posé en HTTPS', () => {
		const cookies = jar({ [`__Secure-${SESSION_COOKIE}`]: 'en-ligne' });
		expect(readAuthCookie(cookies, SESSION_COOKIE)).toBe('en-ligne');
	});

	it('lit le cookie sans préfixe posé en http://localhost', () => {
		const cookies = jar({ [SESSION_COOKIE]: 'local' });
		expect(readAuthCookie(cookies, SESSION_COOKIE)).toBe('local');
	});

	it('renvoie undefined sans cookie', () => {
		expect(readAuthCookie(jar({}), SESSION_COOKIE)).toBeUndefined();
	});

	it('supprime les deux variantes', () => {
		const cookies = jar({});
		deleteAuthCookie(cookies, SESSION_COOKIE);
		expect(cookies.delete).toHaveBeenCalledTimes(2);
	});
});
