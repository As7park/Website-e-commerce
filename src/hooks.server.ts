// -----------------------------------------------------------------------------
// hooks.server.ts — composition des middlewares serveur.
//
// Ce fichier ne contient que de l'assemblage : chaque préoccupation vit dans son
// propre module. L'authentification est fournie par `authHandle`
// (`src/lib/lucia/hooks.ts`) et constitue le seul point de raccordement de
// l'auth au cycle de requête.
//
// Ordre de la chaîne (voir `handle` en bas de fichier) :
//   securityHeaders → devtoolsGuard → cookieGuard → rateLimit → authHandle → adminHandle → pendingOrderHandle
//
// CSRF : aucune configuration `csrf` dans `svelte.config.js` → la protection
// par défaut de SvelteKit (`checkOrigin`, qui bloque les requêtes de type
// formulaire — multipart/form-data, x-www-form-urlencoded, text/plain — dont
// l'origine ne correspond pas) est active, vérifié explicitement (pas juste
// supposé). Les 6 routes `/api/*` custom ont chacune leur propre garde :
// `webhooks`/`jobs/post-payment` vérifient une signature (Stripe/QStash),
// `save-cart` exige une session authentifiée, et `promo/validate`,
// `open-cage-data`, `sendcloud/*` sont des lectures/validations JSON sans
// effet de bord — aucune n'accepte de mutation via un `<form>` HTML classique.
// -----------------------------------------------------------------------------

import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { dev } from '$app/environment';

import { RefillingTokenBucket } from '$lib/server/rate-limit';
import { createPendingOrder, findPendingOrder } from '$lib/prisma/order/prendingOrder';
import { log } from '$lib/server/log';

// AUTH-PLUGIN ▼ retirer cet import et `authHandle` de la séquence finale.
import { authHandle } from '$lib/lucia/hooks';
// AUTH-PLUGIN ▲

// ADMIN-PLUGIN ▼ retirer cet import et `adminHandle` de la séquence finale.
import { adminHandle } from '$lib/admin/hooks';
// ADMIN-PLUGIN ▲

/** Adresse du client, en tenant compte d'un éventuel proxy (Vercel). */
function clientIP(event: Parameters<Handle>[0]['event']): string {
	const xff = event.request.headers.get('x-forwarded-for');
	if (xff) return xff.split(',')[0]!.trim();
	try {
		return event.getClientAddress();
	} catch {
		return '127.0.0.1';
	}
}

/* -------------------------------------------------------------------------- */
/*  Gardes globales (indépendantes de l'authentification)                     */
/* -------------------------------------------------------------------------- */

/**
 * En-têtes de sécurité posés sur toute réponse, quel que soit ce que font les
 * handles suivants. La CSP n'est pas ici : elle est posée nativement par
 * SvelteKit (`kit.csp` dans `svelte.config.js`), qui gère les hash/nonce de
 * ses propres scripts inline — la reproduire à la main ici casserait
 * l'hydratation.
 */
const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	if (!dev) {
		// Uniquement en prod (HTTPS) : sur `localhost` en HTTP, un navigateur qui
		// respecte ce header rendrait le site inaccessible en dev.
		response.headers.set(
			'Strict-Transport-Security',
			'max-age=63072000; includeSubDomains; preload'
		);
	}
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};

/** Coupe court aux sondes de Chrome DevTools, qui polluent les logs. */
const devtoolsGuard: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/.well-known/appspecific/')) {
		log('INFO', 'DevTools', 'Requête DevTools ignorée');
		return new Response(null, { status: 204 });
	}
	return resolve(event);
};

/** Rejette les en-têtes `cookie` non ASCII, que le parseur refuserait plus loin. */
const cookieGuard: Handle = async ({ event, resolve }) => {
	const cookie = event.request.headers.get('cookie') ?? '';
	if (/[^\u0020-\u007E]/.test(cookie)) {
		log('WARN', 'CookieGuard', 'Caractères invalides dans le cookie');
		return new Response('Bad Cookie', { status: 400 });
	}
	return resolve(event);
};

/** Plafond brut par IP : 100 requêtes par seconde. */
const bucket = new RefillingTokenBucket<string>(100, 1, 'global-ip');

const rateLimit: Handle = async ({ event, resolve }) => {
	const ip = clientIP(event);
	if (!(await bucket.consume(ip, 1))) {
		log('WARN', 'RateLimit', 'Quota dépassé pour', ip);
		return new Response('Too many requests', { status: 429 });
	}
	return resolve(event);
};

/* -------------------------------------------------------------------------- */
/*  Panier serveur (commerce)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Attache au visiteur connecté sa commande en cours, en la créant au besoin.
 *
 * COMMERCE-PLUGIN : le hook du tunnel. Ne voit que les commandes `PENDING`.
 * AUTH-PLUGIN : dépend de `locals.user`. Sans authentification, il faut soit
 * supprimer ce hook (panier purement client), soit rattacher la commande à un
 * identifiant de visiteur anonyme stocké en cookie.
 */
const pendingOrderHandle: Handle = async ({ event, resolve }) => {
	const userId = event.locals.user?.id;

	if (userId) {
		try {
			event.locals.pendingOrder =
				(await findPendingOrder(userId)) ?? (await createPendingOrder(userId));
		} catch (error) {
			log('ERROR', 'PendingOrder', 'Récupération impossible', error);
			event.locals.pendingOrder = null;
		}
	} else {
		event.locals.pendingOrder = null;
	}

	return resolve(event);
};

/* -------------------------------------------------------------------------- */
/*  Chaîne finale                                                             */
/* -------------------------------------------------------------------------- */

export const handle: Handle = sequence(
	securityHeaders,
	devtoolsGuard,
	cookieGuard,
	rateLimit,
	// AUTH-PLUGIN ▼ retirer cette ligne pour désactiver l'authentification.
	authHandle,
	// AUTH-PLUGIN ▲
	// ADMIN-PLUGIN ▼ retirer cette ligne pour désactiver l'administration.
	// Doit rester après `authHandle` : il lit `locals.user` / `locals.role`.
	adminHandle,
	// ADMIN-PLUGIN ▲
	// COMMERCE-PLUGIN ▼ retirer cette ligne pour désactiver le panier serveur.
	pendingOrderHandle
	// COMMERCE-PLUGIN ▲
);
