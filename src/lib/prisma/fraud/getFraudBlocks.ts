/** Liste paginée pour `/admin/fraud` — mêmes conventions que `getAllTransactions.ts`. */
import { prisma } from '$lib/server';
import { normalizeListParams, type ListParams } from '$lib/prisma/pagination';
import { formatRiskLevel } from '$lib/server/fraud';

const FRAUD_BLOCK_SORTABLE = ['createdAt', 'riskScore'] as const;

/** Recherche sur l'e-mail du compte bloqué. */
export const getFraudBlocks = async (params: ListParams = {}) => {
	const { page, perPage, skip, search, sort, dir } = normalizeListParams(params, {
		perPage: 20,
		defaultSort: 'createdAt',
		sortable: FRAUD_BLOCK_SORTABLE
	});

	const where = search
		? { email: { contains: search, mode: 'insensitive' as const } }
		: undefined;

	try {
		const [rows, total] = await Promise.all([
			prisma.fraudBlock.findMany({
				where,
				orderBy: { [sort]: dir },
				skip,
				take: perPage
			}),
			prisma.fraudBlock.count({ where })
		]);

		const items = rows.map((block) => ({
			...block,
			riskLabel: `${formatRiskLevel(block.riskLevel)} (${block.riskScore})`,
			riskBadgeVariant:
				block.riskLevel === 'high'
					? ('destructive' as const)
					: block.riskLevel === 'medium'
						? ('outline' as const)
						: ('secondary' as const),
			factorsLabel: block.riskFactors.join(', ') || '—'
		}));

		return { items, total, page, perPage, search, sort, dir };
	} catch (error) {
		console.error('Error retrieving fraud blocks: ', error);
		return { items: [], total: 0, page, perPage, search, sort, dir };
	}
};
