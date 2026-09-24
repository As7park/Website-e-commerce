import { assertAdmin } from '$lib/admin/guards';
import { getFraudBlocks } from '$lib/prisma/fraud/getFraudBlocks';
import type { PageServerLoad } from './$types';

/**
 * Commandes bloquées par la détection de fraude
 * (`StoreSettings.fraudBlockingEnabled`, `$lib/server/fraud.ts`) — jamais de
 * `Transaction`/`Order` payée pour elles, donc invisibles depuis
 * `/admin/sales` sans cette page : le support doit pouvoir retrouver un
 * client bloqué à tort (compte, score, facteurs déclenchés).
 */
export const load = (async ({ locals, url }) => {
	assertAdmin(locals);
	const { items, total, page, perPage, search, sort, dir } = await getFraudBlocks({
		page: Number(url.searchParams.get('page')) || undefined,
		perPage: Number(url.searchParams.get('perPage')) || undefined,
		search: url.searchParams.get('q') ?? undefined,
		sort: url.searchParams.get('sort') ?? undefined,
		dir: url.searchParams.get('dir') === 'desc' ? 'desc' : undefined
	});

	return { blocks: items, total, page, perPage, search, sort, dir };
}) satisfies PageServerLoad;
