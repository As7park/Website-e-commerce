import { Client } from '@upstash/qstash';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Enregistre (une seule fois) le QStash Schedule qui déclenche la relance
 * « produits consultés, jamais achetés » (`/api/jobs/recently-viewed-reminder`,
 * voir `$lib/server/jobs/recentlyViewedReminder.ts`). Même logique
 * idempotente que `register-review-reminder-schedule.mjs` : vérifie qu'aucun
 * schedule n'existe déjà pour cette destination avant d'en créer un.
 *
 * Quotidien, décalé de `cleanup` (3h) et `review-reminder` (6h) pour étaler
 * la charge.
 *
 * Usage : `node scripts/register-recently-viewed-reminder-schedule.mjs`
 * (une fois, après déploiement, ou après un changement d'URL publique).
 */

const CRON = '0 8 * * *'; // tous les jours à 8h

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

	const destination = `${appUrl}/api/jobs/recently-viewed-reminder`;
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
