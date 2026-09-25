import { fail, type Actions } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { PageServerLoad } from './$types';
import { assertAdmin, requireAdmin } from '$lib/admin/guards';
import {
	getStoreFeatureFlagsUncached,
	updateStoreFeatureFlags,
	type StoreFeatureFlags
} from '$lib/server/storeSettings';
import { getVatRate, updateVatRate } from '$lib/server/vat';
import { vatRateSchema } from '$lib/schema/settings/vatSchema';
import { getDeliveryEstimate, updateDeliveryEstimate } from '$lib/server/delivery';
import { deliveryEstimateSchema } from '$lib/schema/settings/deliverySchema';
import { log } from '$lib/server/log';

const FLAG_KEYS = [
	'wishlistEnabled',
	'crossSellEnabled',
	'returnsEnabled',
	'savedPaymentsEnabled',
	'loyaltyEnabled',
	'giftCardsEnabled',
	'productQnaEnabled',
	'cartRecoveryEnabled',
	'flashSaleEnabled',
	'referralEnabled',
	'stockAlertsEnabled',
	'frequentlyBoughtTogetherEnabled',
	'reviewReminderEnabled',
	'wishlistPriceAlertEnabled',
	'fraudDetectionEnabled',
	'fraudBlockingEnabled',
	'recentlyViewedReminderEnabled'
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
	const vatRate = await getVatRate();
	const vatForm = await superValidate({ vatRatePercent: vatRate * 100 }, zod(vatRateSchema), {
		id: 'vatRate'
	});
	const deliveryEstimate = await getDeliveryEstimate();
	const deliveryForm = await superValidate(
		{ minDays: deliveryEstimate?.minDays, maxDays: deliveryEstimate?.maxDays },
		zod(deliveryEstimateSchema),
		{ id: 'deliveryEstimate' }
	);
	return { flags, vatForm, deliveryForm };
}) satisfies PageServerLoad;

export const actions: Actions = {
	// SvelteKit interdit de mélanger une action `default` avec des actions
	// nommées sur la même route (`updateVatRate` ci-dessous) — nommée elle
	// aussi, jamais `default`.
	updateModules: async ({ request, locals }) => {
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
	},

	/**
	 * Taux de TVA (`StoreSettings.vatRate`) — voir `CONFORMITE_ECOMMERCE.md` :
	 * remplace l'ancienne constante figée à 5,5 %, incorrecte pour de la
	 * bijouterie (taux normal attendu). Saisi en pourcentage, converti en
	 * fraction avant écriture.
	 */
	updateVatRate: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(vatRateSchema), { id: 'vatRate' });

		if (!form.valid) {
			return fail(400, { vatForm: form });
		}

		try {
			await updateVatRate(form.data.vatRatePercent / 100);
			log('INFO', 'admin-settings', `Taux de TVA mis à jour par ${locals.user.email}`, {
				vatRatePercent: form.data.vatRatePercent
			});
			return message(form, 'Taux de TVA mis à jour');
		} catch (error) {
			console.error('Error updating VAT rate:', error);
			return fail(500, { vatForm: form, message: "La mise à jour n'a pas pu être enregistrée." });
		}
	},

	/**
	 * Délai de livraison estimé (`StoreSettings.estimatedDelivery{Min,Max}Days`)
	 * — voir CONFORMITE_ECOMMERCE.md : affiché au client avant commande
	 * (Code conso. L216-1), jamais de date inventée par défaut.
	 */
	updateDeliveryEstimate: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(deliveryEstimateSchema), {
			id: 'deliveryEstimate'
		});

		if (!form.valid) {
			return fail(400, { deliveryForm: form });
		}

		try {
			const estimate =
				form.data.minDays != null && form.data.maxDays != null
					? { minDays: form.data.minDays, maxDays: form.data.maxDays }
					: null;
			await updateDeliveryEstimate(estimate);
			log('INFO', 'admin-settings', `Délai de livraison mis à jour par ${locals.user.email}`, {
				estimate
			});
			return message(form, 'Délai de livraison mis à jour');
		} catch (error) {
			console.error('Error updating delivery estimate:', error);
			return fail(500, {
				deliveryForm: form,
				message: "La mise à jour n'a pas pu être enregistrée."
			});
		}
	}
};
