import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listWishlistForUser } from '$lib/prisma/wishlist/wishlist';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';

/**
 * Liste d'envies du compte.
 *
 * PRODUCT-PLUGIN / AUTH-PLUGIN : module activable — 404 si désactivé plutôt
 * qu'une page vide, pour ne pas laisser deviner qu'une route existe.
 */
export const load = (async ({ locals }) => {
	const userId = locals.user?.id;
	if (!userId) {
		redirect(302, '/auth/login');
	}

	const { wishlistEnabled } = await getStoreFeatureFlags();
	if (!wishlistEnabled) {
		error(404, 'Page introuvable');
	}

	const products = await listWishlistForUser(userId);
	return { products };
}) satisfies PageServerLoad;
