import adapter from '@sveltejs/adapter-vercel';
import type { Config } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config: Config = {
	preprocess: vitePreprocess(),

	adapter: adapter({
		runtime: 'nodejs22.x',
		memory: 1024,
		maxDuration: 30
	}),

	// Static source review was used to build this policy. Smoke-test Stripe,
	// TinyMCE, TOTP setup and the Sendcloud service-point map after deployment.
	csp: {
		mode: 'auto',
		directives: {
			'default-src': ['self'],
			'script-src': ['self', 'https://js.stripe.com'],
			'style-src': ['self', 'unsafe-inline'],
			'img-src': [
				'self',
				'data:',
				'blob:',
				'https://res.cloudinary.com',
				'https://tiles.basemaps.cartocdn.com'
			],
			'connect-src': [
				'self',
				'https://api.stripe.com',
				'https://tiles.basemaps.cartocdn.com',
				'https://*.ingest.sentry.io'
			],
			'frame-src': ['https://js.stripe.com', 'https://hooks.stripe.com'],
			'frame-ancestors': ['none'],
			'worker-src': ['self', 'blob:'],
			'report-uri': ['/api/csp-report']
		}
	}
};

export default config;
