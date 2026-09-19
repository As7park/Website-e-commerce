import { Prisma } from '@prisma/client';
import { prisma } from '$lib/server';
import type { ExportKind } from './export';

export interface PurgePreview {
	count: number;
}

export interface PurgeResult {
	deleted: number;
	skipped: number;
}

/**
 * Purge ciblée par ancienneté (`createdAt`), jamais un vidage total de table
 * — voir `docs/admin/README.md` et `$lib/server/jobs/cleanup.ts` (qui purge
 * déjà, automatiquement, les sessions expirées et les paniers abandonnés).
 *
 * `users` porte un filtre supplémentaire NON exposé au paramètre `days` :
 * `emailVerified: false`. Volontairement en dur ici, pas dans l'appelant —
 * purger un compte vérifié par simple ancienneté supprimerait potentiellement
 * un vrai client, un tout autre risque que nettoyer des inscriptions jamais
 * terminées.
 */
function whereFor(kind: ExportKind, cutoff: Date): Record<string, unknown> {
	if (kind === 'users') {
		return { createdAt: { lt: cutoff }, emailVerified: false };
	}
	return { createdAt: { lt: cutoff } };
}

function cutoffDate(days: number): Date {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const DELEGATE: Record<ExportKind, keyof typeof prisma> = {
	sales: 'transaction',
	users: 'user',
	products: 'product',
	blog: 'blogPost',
	promo: 'promoCode',
	contacts: 'contactSubmission'
};

export async function previewPurge(kind: ExportKind, days: number): Promise<PurgePreview> {
	const where = whereFor(kind, cutoffDate(days));
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const delegate = (prisma as any)[DELEGATE[kind]];
	const count: number = await delegate.count({ where });
	return { count };
}

/**
 * Supprime les lignes concernées. `products`/`users` référencent des tables
 * protégées par une contrainte FK `Restrict` (`OrderItem.productId`,
 * `Order.userId`) : plutôt que de laisser `deleteMany` échouer en bloc pour
 * une seule ligne liée à une commande, on supprime ligne à ligne et on
 * compte séparément les échecs FK (`skipped`) — jamais de suppression en
 * cascade forcée de l'historique de vente pour débloquer la purge.
 */
export async function runPurge(kind: ExportKind, days: number): Promise<PurgeResult> {
	const where = whereFor(kind, cutoffDate(days));
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const delegate = (prisma as any)[DELEGATE[kind]];

	if (kind !== 'products' && kind !== 'users') {
		const result = await delegate.deleteMany({ where });
		return { deleted: result.count, skipped: 0 };
	}

	const candidates: { id: string }[] = await delegate.findMany({ where, select: { id: true } });
	let deleted = 0;
	let skipped = 0;
	for (const { id } of candidates) {
		try {
			await delegate.delete({ where: { id } });
			deleted++;
		} catch (err) {
			if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
				skipped++;
				continue;
			}
			throw err;
		}
	}
	return { deleted, skipped };
}
