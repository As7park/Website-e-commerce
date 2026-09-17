/**
 * Numéro d'avoir annuel AV-AAAA-00001, séquence indépendante des factures.
 *
 * COMMERCE-PLUGIN : à appeler dans la même transaction Prisma que le
 * passage `ReturnRequest.status` en REFUNDED/CREDITED (voir
 * `$lib/prisma/returns/returns.ts`), pour éviter les trous / doublons —
 * même pattern que `$lib/server/invoice/number.ts`.
 */
import type { Prisma } from '@prisma/client';

export function formatCreditNoteNumber(year: number, sequence: number): string {
	return `AV-${year}-${String(sequence).padStart(5, '0')}`;
}

export async function nextCreditNoteNumber(tx: Prisma.TransactionClient): Promise<string> {
	const year = new Date().getFullYear();
	const counter = await tx.creditNoteCounter.upsert({
		where: { year },
		create: { year, last: 1 },
		update: { last: { increment: 1 } }
	});
	return formatCreditNoteNumber(year, counter.last);
}
