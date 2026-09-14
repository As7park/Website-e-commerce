import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import * as Sentry from '@sentry/sveltekit';

/**
 * Suivi d'erreurs/traces côté navigateur (plan gratuit Sentry). Sans
 * `PUBLIC_SENTRY_DSN`, le SDK reste un no-op documenté — pas de config
 * supplémentaire requise en local (voir aussi src/hooks.server.ts).
 */
Sentry.init({
	dsn: env.PUBLIC_SENTRY_DSN,
	tracesSampleRate: 0.1
});

export const handleError = Sentry.handleErrorWithSentry();


/**
 * `localhost:2000` est partagé entre plusieurs projets. Un PWA (ici Lezardoises)
 * peut laisser un service worker qui intercepte les requêtes et demande des
 * fichiers hors de ce dépôt — Vite refuse alors de les servir.
 *
 * En développement uniquement, on retire ces workers une fois par onglet.
 */
async function dropStaleServiceWorkers() {
	if (!dev || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
		return;
	}

	if (sessionStorage.getItem('cleared-stale-service-workers')) return;

	const registrations = await navigator.serviceWorker.getRegistrations();
	const controlled = Boolean(navigator.serviceWorker.controller);
	if (registrations.length === 0 && !controlled) return;

	sessionStorage.setItem('cleared-stale-service-workers', '1');

	await Promise.all(registrations.map((registration) => registration.unregister()));

	if ('caches' in window) {
		const keys = await caches.keys();
		await Promise.all(keys.map((key) => caches.delete(key)));
	}

	location.reload();
}

void dropStaleServiceWorkers();
