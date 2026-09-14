import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
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
		include: ['src/**/*.{test,spec}.{js,ts}']
	},

	server: {
		port: 2000,
		strictPort: true,
		watch: {
			usePolling: true,
			interval: 1000
		}
	},

	preprocess: [vitePreprocess()],

	clearScreen: false
});
