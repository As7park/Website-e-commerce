import { fail } from '@sveltejs/kit';
import { assertAdmin, requireAdmin } from '$lib/admin/guards';
import { enqueueExportJob } from '$lib/server/qstash';
import { log } from '$lib/server/log';

import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	assertAdmin(locals);
	return {};
}) satisfies PageServerLoad;

export const actions: Actions = {
	sales: async ({ locals }) => {
		requireAdmin(locals);
		try {
			await enqueueExportJob('sales', locals.user.email);
		} catch (error) {
			log('ERROR', 'export', "Échec du lancement de l'export ventes", error);
			return fail(500, { message: "L'export n'a pas pu être lancé." });
		}
		return { success: true, kind: 'sales' as const };
	},
	users: async ({ locals }) => {
		requireAdmin(locals);
		try {
			await enqueueExportJob('users', locals.user.email);
		} catch (error) {
			log('ERROR', 'export', "Échec du lancement de l'export utilisateurs", error);
			return fail(500, { message: "L'export n'a pas pu être lancé." });
		}
		return { success: true, kind: 'users' as const };
	}
};
