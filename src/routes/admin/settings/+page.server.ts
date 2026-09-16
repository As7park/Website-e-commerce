import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { assertAdmin, requireAdmin } from '$lib/admin/guards';
import {
	getStoreFeatureFlagsUncached,
	updateStoreFeatureFlags,
	type StoreFeatureFlags
} from '$lib/server/storeSettings';
import { log } from '$lib/server/log';

const FLAG_KEYS = [
	'wishlistEnabled',
	'crossSellEnabled',
	'returnsEnabled',
	'savedPaymentsEnabled',
	'loyaltyEnabled',
	'giftCardsEnabled',
	'productQnaEnabled',
	'cartRecoveryEnabled'
] as const satisfies readonly (keyof StoreFeatureFlags)[];

/**
 * Activation des modules e-commerce optionnels de la boutique.
 *
 * ADMIN-PLUGIN : une case cochée ici change immédiatement ce qui est visible
 * côté vitrine (`getStoreFeatureFlags`, lu par chaque route publique
 * concernée) — pas un simple réglage cosmétique.
 */
export const load = (async ({ locals }) => {
	assertAdmin(locals);
	const flags = await getStoreFeatureFlagsUncached();
	return { flags };
}) satisfies PageServerLoad;

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();

		const patch: Partial<StoreFeatureFlags> = {};
		for (const key of FLAG_KEYS) {
			patch[key] = formData.get(key) === 'on';
		}

		try {
			await updateStoreFeatureFlags(patch);
			log('INFO', 'admin-settings', `Modules mis à jour par ${locals.user.email}`, patch);
			return { success: true };
		} catch (error) {
			console.error('Error updating store settings:', error);
			return fail(500, { message: "La mise à jour n'a pas pu être enregistrée." });
		}
	}
};
