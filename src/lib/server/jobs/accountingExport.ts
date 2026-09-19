/**
 * Export comptable mensuel automatisé — remplace l'export manuel ponctuel
 * (`/admin/exports/sales`) par un envoi périodique au comptable/à l'admin,
 * sans action humaine.
 *
 * Scan périodique (comme `cleanup.ts`/`cartRecovery.ts`), PAS un job
 * event-triggered : personne n'enfile quoi que ce soit après une action
 * utilisateur, c'est le cron/QStash Schedule
 * (`scripts/register-accounting-export-schedule.mjs`, route
 * `/api/jobs/accounting-export`) qui rappelle une fois par mois.
 *
 * Format volontairement **inspiré** du FEC (Fichier des Écritures Comptables)
 * — colonnes proches de la nomenclature officielle (JournalCode, EcritureDate,
 * PieceRef, CompteNum...) pour qu'un comptable s'y retrouve — mais PAS un FEC
 * réglementaire complet : une seule écriture par transaction (pas de
 * contrepartie débit/crédit équilibrée par compte de tiers), pas de
 * validation d'export légal. Suffisant comme point de départ d'un
 * rapprochement comptable mensuel, pas comme substitut d'un vrai logiciel de
 * comptabilité.
 */
import { prisma } from '$lib/server';
import { withLock } from '$lib/server/lock';
import { sendMail } from '$lib/server/smtp-mail';
import { log } from '$lib/server/log';
import { withDuration } from '$lib/server/metrics';
import { toCsv } from '$lib/server/export/csv';
import { EXPORT_MAX_ROWS } from '$lib/server/jobs/export';

export const ACCOUNTING_EXPORT_COLUMNS = [
	{ key: 'JournalCode', header: 'JournalCode' },
	{ key: 'JournalLib', header: 'JournalLib' },
	{ key: 'EcritureDate', header: 'EcritureDate' },
	{ key: 'PieceRef', header: 'PieceRef' },
	{ key: 'EcritureLib', header: 'EcritureLib' },
	{ key: 'CompteNum', header: 'CompteNum' },
	{ key: 'CompteLib', header: 'CompteLib' },
	{ key: 'Debit', header: 'Debit' },
	{ key: 'Credit', header: 'Credit' },
	{ key: 'Devise', header: 'Devise' }
] as const;

type AccountingRow = Record<(typeof ACCOUNTING_EXPORT_COLUMNS)[number]['key'], string>;

/** `YYYYMMDD`, format de date utilisé par le FEC officiel. */
function toFecDate(date: Date): string {
	return date.toISOString().slice(0, 10).replace(/-/g, '');
}

export interface AccountingExportPeriod {
	from: Date;
	to: Date;
	label: string;
}

/** Mois calendaire précédant `reference`, en UTC — `[from, to[`. */
export function resolvePreviousMonthRange(reference: Date = new Date()): AccountingExportPeriod {
	const year = reference.getUTCFullYear();
	const month = reference.getUTCMonth(); // 0-based ; mois précédent = month - 1
	const from = new Date(Date.UTC(year, month - 1, 1));
	const to = new Date(Date.UTC(year, month, 1));
	const label = `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, '0')}`;
	return { from, to, label };
}

/** Construit le CSV comptable pour la période `[from, to[` — transactions payées uniquement. */
export async function buildAccountingExportCsv(
	from: Date,
	to: Date
): Promise<{ csv: string; count: number }> {
	const transactions = await prisma.transaction.findMany({
		where: { status: 'paid', createdAt: { gte: from, lt: to } },
		select: {
			id: true,
			invoiceNumber: true,
			createdAt: true,
			amount: true,
			currency: true,
			customer_details_name: true
		},
		orderBy: { createdAt: 'asc' },
		take: EXPORT_MAX_ROWS
	});

	const rows: AccountingRow[] = transactions.map((transaction) => ({
		JournalCode: 'VE',
		JournalLib: 'Ventes',
		EcritureDate: toFecDate(transaction.createdAt),
		PieceRef: transaction.invoiceNumber ?? transaction.id,
		EcritureLib: transaction.customer_details_name || 'Client',
		CompteNum: '706000',
		CompteLib: 'Ventes de marchandises',
		Debit: '',
		Credit: transaction.amount.toFixed(2),
		Devise: transaction.currency.toUpperCase()
	}));

	return { csv: toCsv(rows, [...ACCOUNTING_EXPORT_COLUMNS]), count: rows.length };
}

export interface AccountingExportResult {
	sent: boolean;
	period: string;
	transactionCount: number;
	durationMs: number;
}

/**
 * `ACCOUNTING_EXPORT_EMAIL` manquant → job no-op (comme
 * `cartRecoveryEnabled` désactivé) : rien d'autre ne garde ce réglage en
 * amont, c'est au job de vérifier avant d'agir.
 */
export async function runAccountingExportJob(
	reference: Date = new Date()
): Promise<AccountingExportResult> {
	return withDuration('job.accounting-export', async () => {
		const startedAt = Date.now();
		const { from, to, label } = resolvePreviousMonthRange(reference);

		const recipient = process.env.ACCOUNTING_EXPORT_EMAIL?.trim();
		if (!recipient) {
			log('WARN', 'accounting-export', 'ACCOUNTING_EXPORT_EMAIL non configuré, envoi ignoré');
			return {
				sent: false,
				period: label,
				transactionCount: 0,
				durationMs: Date.now() - startedAt
			};
		}

		// `AccountingExportLog.period` est la clé d'idempotence réelle (persiste
		// entre process/redéploiements) : le verrou Redis ci-dessous ne protège
		// que contre un rejeu CONCURRENT (deux requêtes en même temps), pas contre
		// un rejeu ultérieur (retry QStash après un envoi déjà réussi).
		const alreadySent = await prisma.accountingExportLog.findUnique({ where: { period: label } });
		if (alreadySent) {
			log('INFO', 'accounting-export', 'Export déjà envoyé pour cette période, ignoré', {
				period: label
			});
			return {
				sent: false,
				period: label,
				transactionCount: alreadySent.transactionCount,
				durationMs: Date.now() - startedAt
			};
		}

		// Une seule tentative d'envoi par période : un retry QStash pendant la
		// même minute ne doit pas dupliquer l'e-mail.
		const sent = await withLock(`accounting-export:${label}`, 300, async () => {
			const { csv, count } = await buildAccountingExportCsv(from, to);

			await sendMail({
				to: recipient,
				subject: `Export comptable ${label}`,
				text: `Export comptable du mois ${label} : ${count} transaction(s) payée(s) en pièce jointe (CSV, inspiré du FEC).`,
				html: `<p>Export comptable du mois <strong>${label}</strong> : <strong>${count}</strong> transaction(s) payée(s) en pièce jointe (CSV, inspiré du FEC).</p>`,
				attachments: [
					{
						filename: `export-comptable-${label}.csv`,
						content: Buffer.from(csv, 'utf-8'),
						contentType: 'text/csv'
					}
				]
			});

			await prisma.accountingExportLog.create({
				data: { period: label, transactionCount: count }
			});

			log('INFO', 'accounting-export', 'Export comptable envoyé', {
				period: label,
				recipient,
				transactionCount: count
			});
			return count;
		});

		return {
			sent: sent !== null,
			period: label,
			transactionCount: sent ?? 0,
			durationMs: Date.now() - startedAt
		};
	});
}
