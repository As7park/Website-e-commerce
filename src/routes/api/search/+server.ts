/**
 * Recherche globale (header boutique) : produits + articles de blog,
 * quelques résultats de chaque, pensée pour être appelée à chaque frappe
 * (debounce côté client) — requêtes `select` minimales, pas de relation
 * chargée inutilement, `take` borné plutôt qu'un scan du catalogue entier.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server';
import { RefillingTokenBucket, getClientIP } from '$lib/server/rate-limit';

const RESULTS_PER_TYPE = 5;
const MIN_QUERY_LENGTH = 2;

// Recharge 20 jetons / 10 s par IP : large marge pour une recherche tapée en
// direct (debounce ~250 ms côté client), sans laisser la porte ouverte à un
// aspirateur de résultats.
const searchLimiter = new RefillingTokenBucket<string>(20, 10, 'search');

export const GET: RequestHandler = async (event) => {
	const q = event.url.searchParams.get('q')?.trim() ?? '';
	if (q.length < MIN_QUERY_LENGTH) {
		return json({ products: [], posts: [] });
	}

	const ip = getClientIP(event);
	if (!(await searchLimiter.consume(ip, 1))) {
		return json({ error: 'Too many requests' }, { status: 429 });
	}

	const [products, posts] = await Promise.all([
		prisma.product.findMany({
			where: {
				OR: [
					{ name: { contains: q, mode: 'insensitive' } },
					{ description: { contains: q, mode: 'insensitive' } }
				]
			},
			select: { id: true, slug: true, name: true, price: true, images: true },
			orderBy: { name: 'asc' },
			take: RESULTS_PER_TYPE
		}),
		prisma.blogPost.findMany({
			where: { published: true, title: { contains: q, mode: 'insensitive' } },
			select: { id: true, slug: true, title: true },
			orderBy: { createdAt: 'desc' },
			take: RESULTS_PER_TYPE
		})
	]);

	return json({
		products: products.map((p) => ({
			id: p.id,
			slug: p.slug,
			name: p.name,
			price: p.price,
			image: p.images[0] ?? null
		})),
		posts: posts.map((p) => ({ id: p.id, slug: p.slug, title: p.title }))
	});
};
