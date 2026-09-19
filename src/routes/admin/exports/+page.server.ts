import { assertAdmin } from '$lib/admin/guards';

import type { PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	assertAdmin(locals);
	return {};
}) satisfies PageServerLoad;
