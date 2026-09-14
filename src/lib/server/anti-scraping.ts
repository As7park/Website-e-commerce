/**
 * Anti-scraping ciblé sur le catalogue public (`/products*`).
 *
 * Deux défenses, volontairement heuristiques (pas de garantie absolue) :
 * - Un bucket de rate-limit dédié, plus strict que le plafond global
 *   (`global-ip` dans `hooks.server.ts`) : un visiteur humain qui feuillette
 *   quelques fiches produit ne l'atteint jamais, un crawler qui aspire tout
 *   le catalogue en boucle si.
 * - Une liste de signatures de `User-Agent` typiques des clients HTTP
 *   scriptés (curl, wget, bibliothèques Python/Go/Java, scrapers headless).
 *   Volontairement PAS de blocage des crawlers de moteurs de recherche
 *   connus (Googlebot, Bingbot, etc.) : les bloquer casserait le
 *   référencement, hors sujet ici — un vrai anti-bot fiable demande une
 *   vérification d'IP/reverse-DNS, pas seulement l'en-tête `User-Agent`
 *   (trivialement falsifiable), ce qui dépasse le cadre d'une heuristique
 *   applicative.
 */

const SCRAPER_UA_PATTERNS = [
	/^curl\//i,
	/^wget\//i,
	/python-requests/i,
	/python-urllib/i,
	/^scrapy/i,
	/aiohttp/i,
	/^axios\//i,
	/go-http-client/i,
	/libwww-perl/i,
	/^okhttp/i,
	/^java\//i,
	/^apache-httpclient/i,
	/phantomjs/i,
	/headlesschrome/i
];

/** Heuristique volontairement simple : UA absent, vide, ou signature connue de client scripté. */
export function isSuspiciousUserAgent(userAgent: string | null): boolean {
	const ua = (userAgent ?? '').trim();
	if (ua.length === 0) return true;
	return SCRAPER_UA_PATTERNS.some((pattern) => pattern.test(ua));
}
