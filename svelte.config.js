import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		//
		// Valeurs explicites plutôt que les défauts implicites de l'adapter :
		// les routes de génération PDF (facture/bordereau) et les appels
		// Sendcloud peuvent dépasser la durée par défaut d'une fonction Vercel.
		// `maxDuration` reste soumis au plafond du plan Vercel du projet — à
		// ajuster si le plan ne l'autorise pas.
		adapter: adapter({
			runtime: 'nodejs20.x',
			memory: 1024,
			maxDuration: 30
		}),

		// CSP bloquante : liste de directives auditée statiquement (grep sur
		// tout `src/` pour les domaines externes réellement appelés côté
		// navigateur — voir commit l'ayant basculée pour le détail). `mode:
		// 'auto'` laisse SvelteKit générer les hash/nonce de ses propres
		// scripts inline (bootstrap d'hydratation), pas besoin de les lister
		// à la main.
		// ⚠️ Cet audit est statique (lecture de code), pas une validation
		// DevTools en conditions réelles. Faire un smoke-test après le
		// premier déploiement avec cette politique : checkout jusqu'au
		// paiement Stripe, éditeur TinyMCE (création d'article), QR code
		// TOTP du setup 2FA, et la carte des points relais Sendcloud
		// (ServicePointMap). En cas de blocage inattendu, `/api/csp-report`
		// reste actif même en mode bloquant (il journalise *et* bloque) ;
		// le rollback consiste à repasser `directives` en `reportOnly`.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ["'self'"],
				'script-src': ["'self'", 'https://js.stripe.com'],
				// bits-ui/floating-ui posent des styles inline (popovers, tooltips).
				'style-src': ["'self'", "'unsafe-inline'"],
				// `res.cloudinary.com` : images produits/blog. `tiles.basemaps.cartocdn.com` :
				// sprite de la carte des points relais (MapLibre charge le sprite via
				// une requête `Image`, pas `fetch` — relève donc d'`img-src`, pas de
				// `connect-src`). `blob:` : aperçu local d'image avant upload
				// (`URL.createObjectURL`, formulaires produit admin) — pas d'upload
				// vers le serveur à ce stade, juste un rendu client.
				'img-src': [
					"'self'",
					'data:',
					'blob:',
					'https://res.cloudinary.com',
					'https://tiles.basemaps.cartocdn.com'
				],
				// `tiles.basemaps.cartocdn.com` : tuiles vectorielles + glyphes de la
				// carte des points relais (MapLibre, `ServicePointMap.svelte`), chargés
				// via `fetch`/XHR. `*.ingest.sentry.io` : remontée d'erreurs client
				// (no-op sans `PUBLIC_SENTRY_DSN`, mais la directive doit être présente
				// dès que le DSN est renseigné en prod).
				'connect-src': [
					"'self'",
					'https://api.stripe.com',
					'https://tiles.basemaps.cartocdn.com',
					'https://*.ingest.sentry.io'
				],
				// Stripe Elements s'affiche dans une iframe cross-origin.
				'frame-src': ['https://js.stripe.com', 'https://hooks.stripe.com'],
				'frame-ancestors': ["'none'"],
				// MapLibre GL instancie son propre Web Worker depuis un `blob:` —
				// sans cette directive, `worker-src` retombe sur `script-src` /
				// `default-src` (pas de `blob:`) et le worker est bloqué.
				'worker-src': ["'self'", 'blob:'],
				// Toujours actif en bloquant (journalise sans empêcher l'application
				// de la politique) — canari pour repérer un directive manquante.
				'report-uri': ['/api/csp-report']
			}
		},
		alias: {
			// this will match a file
			$lib: 'src/lib',
			$components: 'src/lib/components',
			$server: 'src/lib/server',
			$store: 'src/lib/store',
			$shadcn: 'src/lib/components/shadcn/ui'
		}
	}
};

export default config;
