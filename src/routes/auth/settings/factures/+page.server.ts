import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getTransactionsByUserId } from '$lib/prisma/transaction/getTransactionsByUserId';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';

export const load = (async ({ locals, url }) => {
	const userId = locals.user?.id;
	if (!userId) {
		throw redirect(302, '/auth/login');
	}

	const { items, total, page, perPage, search, sort, dir } = await getTransactionsByUserId(userId, {
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
		dir,
		returnsEnabled: (await getStoreFeatureFlags()).returnsEnabled
	};
}) satisfies PageServerLoad;
