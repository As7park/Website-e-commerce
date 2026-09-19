/**
 * Bascule inscription à l'alerte de réassort (ajout/retrait).
 *
 * PRODUCT-PLUGIN : authentifié, module activable
 * (`StoreSettings.stockAlertsEnabled`). Un compte désactivé côté admin ne
 * doit pas pouvoir écrire ici même en connaissant la route — vérifié à
 * chaque appel, pas seulement à l'affichage (même garde que `/api/wishlist`).
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleStockAlertSubscription } from '$lib/prisma/stockAlerts/stockAlerts';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';

export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user?.id;
	if (!userId) {
		error(401, 'Unauthorized');
	}

	const { stockAlertsEnabled } = await getStoreFeatureFlags();
	if (!stockAlertsEnabled) {
		error(404, 'Module désactivé');
	}

	const body = await request.json().catch(() => ({}));
	const productId = body?.productId as string | undefined;
	if (!productId) {
		return json({ error: 'productId manquant' }, { status: 400 });
	}

	const subscribed = await toggleStockAlertSubscription(userId, productId);
	return json({ subscribed });
};
