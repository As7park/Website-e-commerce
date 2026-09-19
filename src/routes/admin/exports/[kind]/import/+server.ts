import { error, json } from '@sveltejs/kit';
import { assertAdmin } from '$lib/admin/guards';
import { IMPORT_KINDS, runImport, type ImportKind } from '$lib/server/jobs/import';
import { log } from '$lib/server/log';
import type { RequestHandler } from './$types';

/**
 * Restauration d'un CSV exporté par cette même page. `sales` n'est
 * volontairement pas importable (voir `$lib/server/jobs/import.ts`).
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	assertAdmin(locals);

	const kind = params.kind as ImportKind;
	if (!IMPORT_KINDS.includes(kind)) {
		error(404, 'Import indisponible pour ce jeu de données.');
	}

	const formData = await request.formData();
	const file = formData.get('file');
	if (!(file instanceof File)) {
		error(400, 'Fichier CSV manquant.');
	}

	const text = await file.text();

	try {
		const result = await runImport(kind, text);
		log('INFO', 'import', `Import ${kind} par ${locals.user.email}`, result);
		return json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Échec de l’import.';
		error(400, message);
	}
};
