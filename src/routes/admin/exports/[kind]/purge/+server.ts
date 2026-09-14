import { error, json } from '@sveltejs/kit';
import { assertAdmin } from '$lib/admin/guards';
import { EXPORT_KINDS, type ExportKind } from '$lib/server/jobs/export';
import { previewPurge, runPurge } from '$lib/server/jobs/purge';
import { log } from '$lib/server/log';
import type { RequestHandler } from './$types';

function requireKind(kind: string): ExportKind {
	if (!EXPORT_KINDS.includes(kind as ExportKind)) {
		error(404, 'Export inconnu');
	}
	return kind as ExportKind;
}

function parseDays(raw: string | null): number {
	const days = Number(raw);
	if (!raw || !Number.isFinite(days) || days < 0) {
		error(400, 'Paramètre "days" invalide : entier positif attendu.');
	}
	return Math.floor(days);
}

/** Aperçu en lecture seule — jamais de suppression sur un simple GET. */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	assertAdmin(locals);
	const kind = requireKind(params.kind!);
	const days = parseDays(url.searchParams.get('days'));

	const preview = await previewPurge(kind, days);
	return json(preview);
};

/**
 * Exécute la purge. Pour `sales`, exige `confirmText === 'SUPPRIMER'` — pas
 * seulement désactivé côté client, vérifié ici aussi, pour qu'une requête
 * rejouée ne puisse pas contourner la confirmation. Voir la politique de
 * purge dans `$lib/server/jobs/purge.ts`.
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	assertAdmin(locals);
	const kind = requireKind(params.kind!);

	const body = await request.json().catch(() => ({}));
	const days = typeof body.days === 'number' ? body.days : Number(body.days);
	if (!Number.isFinite(days) || days < 0) {
		error(400, 'Paramètre "days" invalide : entier positif attendu.');
	}

	if (kind === 'sales' && body.confirmText !== 'SUPPRIMER') {
		error(400, 'Confirmation manquante ou incorrecte pour la purge des ventes.');
	}

	const result = await runPurge(kind, Math.floor(days));
	log('WARN', 'purge', `Purge ${kind} par ${locals.user.email}`, {
		days: Math.floor(days),
		...result
	});
	return json(result);
};
