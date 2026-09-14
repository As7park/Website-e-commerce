import { Client, Receiver } from '@upstash/qstash';
import { resolveAppUrl } from './app-url';
import { runPostPaymentJob } from './jobs/post-payment';
import { runInvoiceEmailJob } from './jobs/invoice-email';
import { runExportJob, type ExportKind } from './jobs/export';

/**
 * Queue Upstash QStash — HTTP, sans process persistant, cohérente avec le
 * déploiement serverless Vercel et avec Upstash Redis déjà en place.
 *
 * QStash doit rappeler une URL publique (jamais `localhost`) : `APP_URL` est
 * explicite, ou à défaut `VERCEL_URL` (fourni automatiquement par Vercel).
 * Sans l'un des deux, ou sans `QSTASH_TOKEN`, on retombe sur l'exécution
 * directe du job — comportement synchrone actuel, sans configuration
 * supplémentaire requise en local.
 */

export function isQStashConfigured(): boolean {
	return Boolean(process.env.QSTASH_TOKEN) && resolveAppUrl() !== null;
}

const globalForQStash = globalThis as unknown as { qstashClient?: Client };

function getClient(): Client {
	if (!globalForQStash.qstashClient) {
		globalForQStash.qstashClient = new Client({ token: process.env.QSTASH_TOKEN! });
	}
	return globalForQStash.qstashClient;
}

export function getQStashReceiver(): Receiver {
	return new Receiver({
		currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
		nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY
	});
}

/**
 * Enfile le travail Sendcloud (commande + étiquette) pour la transaction
 * donnée. Sans QStash configuré, exécute le job directement — mêmes effets,
 * juste synchrones, comme avant l'introduction de la queue.
 */
export async function enqueuePostPaymentJob(transactionId: string): Promise<void> {
	if (!isQStashConfigured()) {
		await runPostPaymentJob(transactionId);
		return;
	}

	await getClient().publishJSON({
		url: `${resolveAppUrl()}/api/jobs/post-payment`,
		body: { transactionId }
	});
}

/**
 * Enfile l'envoi de la facture, indépendamment du job Sendcloud : une file
 * séparée pour ne pas coupler les limites de débit SMTP à Sendcloud (voir
 * `$lib/server/jobs/invoice-email.ts`).
 */
export async function enqueueInvoiceEmailJob(transactionId: string): Promise<void> {
	if (!isQStashConfigured()) {
		await runInvoiceEmailJob(transactionId);
		return;
	}

	await getClient().publishJSON({
		url: `${resolveAppUrl()}/api/jobs/invoice-email`,
		body: { transactionId }
	});
}

/**
 * Enfile un export CSV (ventes ou utilisateurs) demandé depuis l'admin
 * (`/admin/exports`). Génération + upload Cloudinary + e-mail peuvent
 * prendre plusieurs secondes sur un gros volume : jamais dans le chemin
 * synchrone d'une requête HTTP admin.
 */
export async function enqueueExportJob(kind: ExportKind, requestedByEmail: string): Promise<void> {
	if (!isQStashConfigured()) {
		await runExportJob(kind, requestedByEmail);
		return;
	}

	await getClient().publishJSON({
		url: `${resolveAppUrl()}/api/jobs/export`,
		body: { kind, requestedByEmail }
	});
}
