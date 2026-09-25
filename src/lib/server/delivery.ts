/**
 * Délai de livraison estimé (`StoreSettings.estimatedDelivery{Min,Max}Days`,
 * ligne unique `id = "singleton"`, même ligne que `$lib/server/storeSettings.ts`).
 * `null` tant que l'admin ne l'a pas saisi depuis `/admin/settings` — aucune
 * date inventée, affiché au client uniquement si les deux bornes sont posées
 * (Code conso. art. L216-1 : le délai doit être communiqué avant la commande).
 *
 * Même cache courte durée que `getVatRate`/`getStoreFeatureFlags`.
 */
import { prisma } from '$lib/server';
import { cached, bumpCacheVersion, getCacheVersion } from '$lib/server/cache';

const CACHE_NAMESPACE = 'settings';
const CACHE_TTL_SECONDS = 30;
const SINGLETON_ID = 'singleton';

export type DeliveryEstimate = { minDays: number; maxDays: number } | null;

export async function getDeliveryEstimate(): Promise<DeliveryEstimate> {
	const version = await getCacheVersion(CACHE_NAMESPACE);
	const key = `${CACHE_NAMESPACE}:v${version}:deliveryEstimate`;
	return cached(key, CACHE_TTL_SECONDS, async () => {
		const row = await prisma.storeSettings.findUnique({ where: { id: SINGLETON_ID } });
		if (!row?.estimatedDeliveryMinDays || !row?.estimatedDeliveryMaxDays) return null;
		return { minDays: row.estimatedDeliveryMinDays, maxDays: row.estimatedDeliveryMaxDays };
	});
}

export async function updateDeliveryEstimate(estimate: DeliveryEstimate): Promise<void> {
	await prisma.storeSettings.update({
		where: { id: SINGLETON_ID },
		data: {
			estimatedDeliveryMinDays: estimate?.minDays ?? null,
			estimatedDeliveryMaxDays: estimate?.maxDays ?? null
		}
	});
	await bumpCacheVersion(CACHE_NAMESPACE);
}
