/**
 * Liste des ventes.
 *
 * ADMIN-PLUGIN / COMMERCE-PLUGIN : surface admin du tunnel (Transaction).
 */
import { getAllTransactions } from '$lib/prisma/transaction/getAllTransactions';
import type { PageServerLoad } from './$types';

export const load = (async ({ url }) => {
	const { items, total, page, perPage, search, sort, dir } = await getAllTransactions({
		page: Number(url.searchParams.get('page')) || undefined,
		perPage: Number(url.searchParams.get('perPage')) || undefined,
		search: url.searchParams.get('q') ?? undefined,
		sort: url.searchParams.get('sort') ?? undefined,
		dir: url.searchParams.get('dir') === 'desc' ? 'desc' : undefined
	});

	return {
		transactions: items,
		total,
		page,
		perPage,
		search,
		sort,
		dir
	};
}) satisfies PageServerLoad;
