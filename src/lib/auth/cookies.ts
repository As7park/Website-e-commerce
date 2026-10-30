/**
 * Reporte les `Set-Cookie` renvoyés par un appel `auth.api.xxx({ ...,
 * returnHeaders: true })` sur la réponse SvelteKit en cours.
 *
 * SvelteKit interdit `event.setHeaders({ 'set-cookie': ... })` (il faut
 * passer par `event.cookies.set`, qui attend un nom/valeur/options séparés,
 * pas une chaîne `Set-Cookie` brute) — ce module fait le pont entre les deux.
 */
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Nom du cookie signé éphémère que Better Auth pose lui-même quand
 * `signInEmail` renvoie `{ twoFactorRedirect: true }` (plugin `two-factor`,
 * `TWO_FACTOR_COOKIE_NAME`). Jamais décodé ici — seule sa PRÉSENCE sert de
 * garde d'accès pour `/auth/2fa`/`/auth/2fa/reset` (distinguer un visiteur
 * anonyme d'une connexion en attente de second facteur) ; sa validité réelle
 * n'est vérifiée que par Better Auth lui-même
 * (`auth.api.verifyTOTP`/`verifyBackupCode`), jamais par ce code — un cookie
 * forgé échoue simplement à cette étape, sans jamais être traité comme
 * valide ici.
 */
export const TWO_FACTOR_PENDING_COOKIE = 'better-auth.two_factor';

const ATTRIBUTE_KEYS = new Set([
	'expires',
	'max-age',
	'domain',
	'path',
	'secure',
	'httponly',
	'samesite'
]);

function parseSetCookie(
	raw: string
): { name: string; value: string; options: Record<string, unknown> } | null {
	const parts = raw.split(';').map((part) => part.trim());
	const [nameValue, ...attributeParts] = parts;
	const eqIndex = nameValue.indexOf('=');
	if (eqIndex === -1) return null;

	const name = nameValue.slice(0, eqIndex);
	const value = decodeURIComponent(nameValue.slice(eqIndex + 1));

	const options: Record<string, unknown> = { path: '/' };
	for (const attribute of attributeParts) {
		const [rawKey, rawVal] = attribute.split('=');
		const key = rawKey.trim().toLowerCase();
		if (!ATTRIBUTE_KEYS.has(key)) continue;

		switch (key) {
			case 'max-age':
				options.maxAge = Number(rawVal);
				break;
			case 'expires':
				options.expires = new Date(rawVal);
				break;
			case 'path':
				options.path = rawVal;
				break;
			case 'domain':
				options.domain = rawVal;
				break;
			case 'secure':
				options.secure = true;
				break;
			case 'httponly':
				options.httpOnly = true;
				break;
			case 'samesite':
				options.sameSite = rawVal?.toLowerCase();
				break;
		}
	}

	return { name, value, options };
}

/** À appeler juste après tout `auth.api.xxx({ returnHeaders: true })`. */
export function applyAuthCookies(event: RequestEvent, headers: Headers | undefined) {
	if (!headers) return;

	const rawCookies =
		typeof headers.getSetCookie === 'function'
			? headers.getSetCookie()
			: (headers.get('set-cookie')?.split(/,(?=[^;]+=[^;]+)/) ?? []);

	for (const raw of rawCookies) {
		const parsed = parseSetCookie(raw);
		if (!parsed) continue;
		// `path`/`options` castés : les attributs ci-dessus correspondent 1:1 à
		// `CookieSerializeOptions`, juste construits dynamiquement.
		event.cookies.set(
			parsed.name,
			parsed.value,
			parsed.options as unknown as Parameters<typeof event.cookies.set>[2]
		);
	}
}
