import { json, error } from '@sveltejs/kit';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';
import { getFrequentlyBoughtTogether } from '$lib/prisma/bundles/bundles';

/**
 * Suggestions « souvent achetés ensemble » pour le panier courant.
 *
 * BUNDLE-PLUGIN : lecture publique (pas de mutation), 404 si le module est
 * désactivé — même garde que `/api/wishlist`/`/api/stock-alerts`. `productIds`
 * (CSV) vient du store client (`$cart.items`), jamais de données serveur.
 */
export async function GET({ url }) {
	const { frequentlyBoughtTogetherEnabled } = await getStoreFeatureFlags();
	if (!frequentlyBoughtTogetherEnabled) {
		error(404, 'Module désactivé');
	}

	const productIds = (url.searchParams.get('productIds') ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);

	if (productIds.length === 0) {
		return json({ suggestions: [] });
	}

	// Une suggestion par produit du panier au plus, jamais de doublon entre
	// elles ni avec un produit déjà présent dans le panier.
	const seen = new Set(productIds);
	const suggestions = [];
	for (const productId of productIds) {
		const [top] = await getFrequentlyBoughtTogether(productId, [...seen], 1);
		if (top) {
			seen.add(top.id);
			suggestions.push(top);
		}
		if (suggestions.length >= 3) break;
	}

	return json({ suggestions });
}
