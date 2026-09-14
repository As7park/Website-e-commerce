import { error } from '@sveltejs/kit';
import { assertAdmin } from '$lib/admin/guards';
import { buildExportCsv, EXPORT_KINDS, type ExportKind } from '$lib/server/jobs/export';
import type { RequestHandler } from './$types';

/**
 * Téléchargement direct d'un export CSV — plus de file d'attente ni d'e-mail
 * (voir historique : la génération/l'upload marchaient, seul l'envoi SMTP
 * échouait selon la configuration Brevo, pour un gain marginal vu la taille
 * réelle des exports). Le CSV part directement en réponse HTTP.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	assertAdmin(locals);

	const kind = params.kind as ExportKind;
	if (!EXPORT_KINDS.includes(kind)) {
		error(404, 'Export inconnu');
	}

	const csv = await buildExportCsv(kind);
	const date = new Date().toISOString().slice(0, 10);

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${kind}-${date}.csv"`
		}
	});
};
