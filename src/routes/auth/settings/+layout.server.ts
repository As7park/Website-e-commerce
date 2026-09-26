import type { LayoutServerLoad } from './$types';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';

/**
 * Menu de l'espace client (voir `+layout.svelte`) : les entrées liées à un
 * module optionnel ne s'affichent que si le module est actif. Chaque page
 * garde ses propres contrôles d'accès (redirections de `+page.server.ts`).
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const { wishlistEnabled, savedPaymentsEnabled, returnsEnabled, referralEnabled } =
		await getStoreFeatureFlags();

	return {
		accountNav: {
			isClient: locals.user?.role === 'CLIENT',
			wishlistEnabled,
			savedPaymentsEnabled,
			returnsEnabled,
			referralEnabled
		}
	};
};
