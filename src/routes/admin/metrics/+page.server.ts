import { assertAdmin } from '$lib/admin/guards';
import { getMetricsSnapshot } from '$lib/server/metrics';

import type { PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	assertAdmin(locals);

	const snapshot = await getMetricsSnapshot();

	return { snapshot };
}) satisfies PageServerLoad;
