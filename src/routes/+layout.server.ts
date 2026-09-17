import type { LayoutServerLoad } from './$types';
import { toPublicCart } from '$lib/commerce/cart';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';

/**
 * Données partagées par toutes les pages.
 *
 * Elles traversent le réseau : n'exposer ici que le strict nécessaire à
 * l'interface (menu compte, garde d'affichage), jamais un secret.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	// BUNDLE-PLUGIN ▼ le tiroir panier (`Cart.svelte`) affiche ses suggestions
	// partout, donc à même le layout racine plutôt que page par page.
	const { frequentlyBoughtTogetherEnabled } = await getStoreFeatureFlags();
	// BUNDLE-PLUGIN ▲

	return {
		frequentlyBoughtTogetherEnabled,
		// AUTH-PLUGIN ▼ alimente le menu compte (`Cart.svelte`, `Navigation.svelte`).
		// Projection explicite : `locals.user` porte aussi la clé TOTP chiffrée, qui
		// ne doit jamais quitter le serveur. Toute nouvelle propriété doit être
		// ajoutée ici sciemment.
		user: locals.user
			? {
					id: locals.user.id,
					email: locals.user.email,
					username: locals.user.username,
					name: locals.user.name,
					picture: locals.user.picture,
					role: locals.user.role,
					emailVerified: locals.user.emailVerified,
					isMfaEnabled: locals.user.isMfaEnabled,
					registered2FA: locals.user.registered2FA
				}
			: null,
		// AUTH-PLUGIN ▲

		// COMMERCE-PLUGIN ▼ hydratation du panier client depuis la commande PENDING.
		pendingOrder: locals.pendingOrder
			? toPublicCart(locals.pendingOrder as Parameters<typeof toPublicCart>[0])
			: null
		// COMMERCE-PLUGIN ▲
	};
};
