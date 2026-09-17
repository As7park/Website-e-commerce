import { json } from '@sveltejs/kit';
import { getQStashReceiver } from '$lib/server/qstash';
import { runWishlistPriceAlertJob } from '$lib/server/jobs/wishlistPriceAlert';

/**
 * Appelé par QStash (`$lib/server/qstash.ts` → `enqueueWishlistPriceAlertJob`),
 * jamais directement par un client — même garde de signature que
 * `/api/jobs/stock-alerts`.
 */
export async function POST({ request }) {
	const body = await request.text();
	const signature = request.headers.get('upstash-signature');

	if (!signature) {
		return json({ error: 'Signature manquante' }, { status: 401 });
	}

	try {
		await getQStashReceiver().verify({ signature, body, url: request.url });
	} catch (error) {
		console.error('⚠️ Signature QStash invalide.', error);
		return json({ error: 'Signature invalide' }, { status: 401 });
	}

	const { productId } = JSON.parse(body) as { productId?: string };
	if (!productId) {
		return json({ error: 'productId manquant' }, { status: 400 });
	}

	await runWishlistPriceAlertJob(productId);

	return json({ received: true }, { status: 200 });
}
