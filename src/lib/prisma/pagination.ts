/**
 * Contrat commun des listes admin paginées côté serveur (produits,
 * utilisateurs, ventes) : mêmes noms de paramètres et de clamping partout,
 * pour que `Table.svelte` (mode `server`) et les routes qui l'alimentent
 * n'aient qu'un seul format à connaître.
 */

export interface ListParams {
	page?: number;
	perPage?: number;
	search?: string;
	sort?: string;
	dir?: 'asc' | 'desc';
}

export interface ListResult<T> {
	items: T[];
	total: number;
	page: number;
	perPage: number;
	search: string;
	sort: string;
	dir: 'asc' | 'desc';
}

const MAX_PER_PAGE = 100;

/**
 * Normalise page/perPage/recherche/tri, et calcule le `skip` Prisma.
 * `defaultSort` doit être une colonne triable par l'appelant ; `sort` n'est
 * accepté que s'il figure dans `sortable` (whitelist), pour ne jamais passer
 * une colonne arbitraire à un `orderBy` Prisma.
 */
export function normalizeListParams(
	params: ListParams,
	options: { perPage?: number; defaultSort: string; sortable: readonly string[] }
) {
	const page = Math.max(1, Math.floor(Number(params.page) || 1));
	const perPage = Math.max(
		1,
		Math.min(MAX_PER_PAGE, Math.floor(Number(params.perPage) || options.perPage || 20))
	);
	const search = (params.search ?? '').trim();
	const sort = options.sortable.includes(params.sort ?? '') ? params.sort! : options.defaultSort;
	const dir: 'asc' | 'desc' = params.dir === 'desc' ? 'desc' : 'asc';

	return { page, perPage, skip: (page - 1) * perPage, search, sort, dir };
}
