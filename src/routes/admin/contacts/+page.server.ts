import { getAllContactSubmissions } from '$lib/prisma/contact/contact';
import type { PageServerLoad } from './$types';

/** CONTACT-PLUGIN : liste admin. Gardes = module admin. */

export const load = (async ({ url }) => {
	const { items, total, page, perPage, search, sort, dir } = await getAllContactSubmissions({
		page: Number(url.searchParams.get('page')) || undefined,
		perPage: Number(url.searchParams.get('perPage')) || undefined,
		search: url.searchParams.get('q') ?? undefined,
		sort: url.searchParams.get('sort') ?? undefined,
		dir: url.searchParams.get('dir') === 'desc' ? 'desc' : undefined
	});

	return {
		contactSubmissions: items,
		total,
		page,
		perPage,
		search,
		sort,
		dir
	};
}) satisfies PageServerLoad;
