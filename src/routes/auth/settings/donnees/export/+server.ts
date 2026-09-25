/**
 * Export RGPD (droit à la portabilité, art. 20) — même patron de garde que
 * la facture PDF (`/auth/settings/factures/[id]/pdf`) : authentifié,
 * strictement scopé au compte courant.
 */
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildUserDataExport } from '$lib/server/gdpr/exportUserData';

export const GET: RequestHandler = async ({ locals }) => {
	const userId = locals.user?.id;
	if (!userId) {
		throw redirect(302, '/auth/login');
	}

	const data = await buildUserDataExport(userId);
	const date = new Date().toISOString().slice(0, 10);

	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="mes-donnees-${date}.json"`
		}
	});
};
