import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { sentrySvelteKit } from '@sentry/sveltekit';
import { dropStalePwa } from './vite-plugin-drop-stale-pwa';

/** @type {import('vite').UserConfig} */
export default defineConfig({
	// `sentrySvelteKit()` doit précéder `sveltekit()` : instrumentation auto
	// des routes/handles. `autoUploadSourceMaps: false` : l'upload de source
	// maps nécessite un compte Sentry + `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/
	// `SENTRY_PROJECT` en CI, hors de portée d'un usage local — désactivé
	// explicitement plutôt que de laisser échouer silencieusement au build.
	plugins: [
		sentrySvelteKit({ autoUploadSourceMaps: false }),
		dropStalePwa(),
		tailwindcss(),
		sveltekit()
	],

	optimizeDeps: {
		exclude: ['@node-rs/argon2', '@node-rs/bcrypt']
	},

	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'json-summary'],
			include: ['src/**/*.{ts,js}'],
			exclude: ['src/**/*.{test,spec}.{js,ts}'],
			// Seuil uniquement sur `src/lib/**` (logique métier) : les
			// `+page.server.ts`/`+server.ts` de `src/routes/**` sont fins et
			// couverts par Playwright, pas par Vitest — un seuil global aurait
			// mélangé les deux et serait resté décoratif. Valeurs = mesure
			// réelle du 12/10/2026 (14.31/60.75/59.02%) avec ~1 pt de marge
			// pour éviter un échec sur simple bruit de mesure ; à remonter
			// progressivement, jamais à baisser sans le documenter ici.
			thresholds: {
				'src/lib/**': { statements: 13, branches: 58, functions: 57, lines: 13 }
			}
		}
	},

	server: {
		port: 2000,
		strictPort: true,
		watch: {
			usePolling: true,
			interval: 1000
		},
		// Autorise le tunnel `localtunnel` (`npx localtunnel --port 2000`) pour
		// recevoir un vrai webhook entrant (Sendcloud, etc.) en dev — Vite
		// bloque sinon toute requête dont le header `Host` n'est pas connu.
		// Dev uniquement : `vite dev` ne tourne jamais en production.
		allowedHosts: ['.loca.lt']
	},

	// `preprocess` retiré : redondant avec svelte.config.js (vitePreprocess()
	// y est déjà déclaré, seul endroit pertinent pour cette option).

	clearScreen: false
});
