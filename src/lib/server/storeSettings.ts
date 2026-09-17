/**
 * Interrupteurs des modules e-commerce optionnels (`StoreSettings`, ligne
 * unique `id = "singleton"`, garantie par la migration — jamais créée à la
 * volée ici). Lue par les routes publiques pour savoir si un module doit
 * apparaître ; modifiée uniquement depuis `/admin/settings`.
 *
 * Cache courte durée (comme `$lib/products/catalog`) : ces lectures arrivent
 * sur quasi toutes les pages vitrine, la fraîcheur immédiate importe moins
 * que sur `/admin/settings` lui-même, qui ne passe jamais par ce cache.
 */
import { prisma } from '$lib/server';
import { cached, bumpCacheVersion, getCacheVersion } from '$lib/server/cache';

const CACHE_NAMESPACE = 'settings';
const CACHE_TTL_SECONDS = 30;
const SINGLETON_ID = 'singleton';

export interface StoreFeatureFlags {
	wishlistEnabled: boolean;
	crossSellEnabled: boolean;
	returnsEnabled: boolean;
	savedPaymentsEnabled: boolean;
	loyaltyEnabled: boolean;
	giftCardsEnabled: boolean;
	productQnaEnabled: boolean;
	cartRecoveryEnabled: boolean;
	flashSaleEnabled: boolean;
	referralEnabled: boolean;
	stockAlertsEnabled: boolean;
	frequentlyBoughtTogetherEnabled: boolean;
	reviewReminderEnabled: boolean;
	wishlistPriceAlertEnabled: boolean;
}

const DEFAULT_FLAGS: StoreFeatureFlags = {
	wishlistEnabled: false,
	crossSellEnabled: false,
	returnsEnabled: false,
	savedPaymentsEnabled: false,
	loyaltyEnabled: false,
	giftCardsEnabled: false,
	productQnaEnabled: false,
	cartRecoveryEnabled: false,
	flashSaleEnabled: false,
	referralEnabled: false,
	stockAlertsEnabled: false,
	frequentlyBoughtTogetherEnabled: false,
	reviewReminderEnabled: false,
	wishlistPriceAlertEnabled: false
};

/** Lecture mise en cache — utilisée par les routes publiques. */
export async function getStoreFeatureFlags(): Promise<StoreFeatureFlags> {
	const version = await getCacheVersion(CACHE_NAMESPACE);
	const key = `${CACHE_NAMESPACE}:v${version}:flags`;
	return cached(key, CACHE_TTL_SECONDS, async () => {
		const row = await prisma.storeSettings.findUnique({ where: { id: SINGLETON_ID } });
		if (!row) return DEFAULT_FLAGS;
		return {
			wishlistEnabled: row.wishlistEnabled,
			crossSellEnabled: row.crossSellEnabled,
			returnsEnabled: row.returnsEnabled,
			savedPaymentsEnabled: row.savedPaymentsEnabled,
			loyaltyEnabled: row.loyaltyEnabled,
			giftCardsEnabled: row.giftCardsEnabled,
			productQnaEnabled: row.productQnaEnabled,
			cartRecoveryEnabled: row.cartRecoveryEnabled,
			flashSaleEnabled: row.flashSaleEnabled,
			referralEnabled: row.referralEnabled,
			stockAlertsEnabled: row.stockAlertsEnabled,
			frequentlyBoughtTogetherEnabled: row.frequentlyBoughtTogetherEnabled,
			reviewReminderEnabled: row.reviewReminderEnabled,
			wishlistPriceAlertEnabled: row.wishlistPriceAlertEnabled
		};
	});
}

/** Lecture directe (non mise en cache) — pour `/admin/settings` uniquement. */
export async function getStoreFeatureFlagsUncached(): Promise<StoreFeatureFlags> {
	const row = await prisma.storeSettings.findUnique({ where: { id: SINGLETON_ID } });
	return row ?? DEFAULT_FLAGS;
}

export async function updateStoreFeatureFlags(
	patch: Partial<StoreFeatureFlags>
): Promise<StoreFeatureFlags> {
	const row = await prisma.storeSettings.update({
		where: { id: SINGLETON_ID },
		data: patch
	});
	await bumpCacheVersion(CACHE_NAMESPACE);
	return row;
}
