import { Client } from '@upstash/qstash';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Enregistre (une seule fois) le QStash Schedule qui déclenche la relance de
 * panier abandonné (`/api/jobs/cart-recovery`, voir
 * `$lib/server/jobs/cartRecovery.ts`). Même logique idempotente que
 * `register-cleanup-schedule.mjs` : vérifie qu'aucun schedule n'existe déjà
 * pour cette destination avant d'en créer un.
 *
 * Fréquence plus élevée que le cleanup (quotidien) : les paliers de relance
 * sont à 1h/24h, une granularité de 30 min suffit à les détecter sans retard
 * perceptible.
 *
 * Usage : `node scripts/register-cart-recovery-schedule.mjs` (une fois, après
 * déploiement, ou après un changement d'URL publique).
 */

const CRON = '*/30 * * * *'; // toutes les 30 minutes

function resolveAppUrl() {
	if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
	if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
	return null;
}

async function main() {
	const token = process.env.QSTASH_TOKEN;
	if (!token) {
		throw new Error('QSTASH_TOKEN manquant : rien à enregistrer sans QStash configuré.');
	}
	const appUrl = resolveAppUrl();
	if (!appUrl) {
		throw new Error('APP_URL (ou VERCEL_URL) manquant : QStash ne doit jamais rappeler localhost.');
	}

	const destination = `${appUrl}/api/jobs/cart-recovery`;
	const client = new Client({ token });

	const existing = await client.schedules.list();
	const already = existing.find((s) => s.destination === destination && s.cron === CRON);
	if (already) {
		console.log(`Schedule déjà enregistré (${already.scheduleId}) → ${destination} @ "${CRON}"`);
		return;
	}

	const { scheduleId } = await client.schedules.create({
		destination,
		cron: CRON,
		retries: 3
	});
	console.log(`Schedule créé (${scheduleId}) → ${destination} @ "${CRON}"`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
