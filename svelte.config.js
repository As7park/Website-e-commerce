import adapter from '@sveltejs/adapter-vercel';
import { VitePWA } from 'vite-plugin-pwa';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';


/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	
	plugins: [
		VitePWA({
			manifest: {
				// les options pour votre manifeste
				name: 'Mon App SvelteKit PWA',
				short_name: 'SvelteKitPWA',
				description: 'Une démo de PWA avec SvelteKit et Vite',
				icons: [
					// Vos icônes pour la PWA
				]
				// ... d'autres options du manifeste
			},
			workbox: {
				// les options pour workbox
				swSrc: '/sw.js',
				// Uniquement les images produits Cloudinary : pas de règle catch-all
				// same-origin (le cache runtime ne doit jamais contenir /api, /admin,
				// /auth ou toute réponse porteuse de données utilisateur).
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/res\.cloudinary\.com\//,
						handler: 'CacheFirst',
						options: {
							cacheName: 'cloudinary-images',
							expiration: {
								maxEntries: 200,
								maxAgeSeconds: 30 * 24 * 60 * 60 // 30 jours
							}
						}
					}
				]
			}
		})
	],
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

			// CSP en Report-Only : une politique mal calibrée casserait
			// silencieusement Stripe Checkout ou l'éditeur de blog — sur un site
			// marchand, le pire endroit pour se tromper. `mode: 'auto'` laisse
			// SvelteKit générer les hash/nonce de ses propres scripts inline
			// (bootstrap d'hydratation), pas besoin de les lister à la main.
			// À rendre bloquante (reportOnly → directives) seulement après avoir
			// confirmé, DevTools ouvertes, l'absence de violation sur le
			// checkout (jusqu'au paiement Stripe), l'éditeur TinyMCE et le QR
			// code TOTP du setup 2FA (`data:` URI, couvert par `img-src`).
			csp: {
				mode: 'auto',
				reportOnly: {
					'default-src': ["'self'"],
					'script-src': ["'self'", 'https://js.stripe.com'],
					// bits-ui/floating-ui posent des styles inline (popovers, tooltips).
					'style-src': ["'self'", "'unsafe-inline'"],
					'img-src': ["'self'", 'data:', 'https://res.cloudinary.com'],
					'connect-src': ["'self'", 'https://api.stripe.com'],
					// Stripe Elements s'affiche dans une iframe cross-origin.
					'frame-src': ['https://js.stripe.com', 'https://hooks.stripe.com'],
					'frame-ancestors': ["'none'"],
					// Requis par SvelteKit pour un `report-only` (sinon 500 sur
					// toute réponse) — collecté par `/api/csp-report`.
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
