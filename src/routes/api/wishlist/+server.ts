/**
 * Bascule liste d'envies (ajout/retrait).
 *
 * PRODUCT-PLUGIN : authentifié, module activable (`StoreSettings.wishlistEnabled`).
 * Un compte désactivé côté admin ne doit pas pouvoir écrire ici même en
 * connaissant la route — vérifié à chaque appel, pas seulement à l'affichage.
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleWishlistItem } from '$lib/prisma/wishlist/wishlist';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';

export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user?.id;
	if (!userId) {
		error(401, 'Unauthorized');
	}

	const { wishlistEnabled } = await getStoreFeatureFlags();
	if (!wishlistEnabled) {
		error(404, 'Module désactivé');
	}

	const body = await request.json().catch(() => ({}));
	const productId = body?.productId as string | undefined;
	if (!productId) {
		return json({ error: 'productId manquant' }, { status: 400 });
	}

	const inWishlist = await toggleWishlistItem(userId, productId);
	return json({ inWishlist });
};
