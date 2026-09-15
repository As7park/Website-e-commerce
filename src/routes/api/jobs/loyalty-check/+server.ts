import { json } from '@sveltejs/kit';
import { getQStashReceiver } from '$lib/server/qstash';
import { runLoyaltyCheckJob } from '$lib/server/jobs/loyalty';

/**
 * Appelé par QStash (`$lib/server/qstash.ts` → `enqueueLoyaltyCheckJob`),
 * jamais directement par un client — même garde de signature que
 * `/api/jobs/invoice-email` et `/api/jobs/post-payment`.
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

	const { orderId } = JSON.parse(body) as { orderId?: string };
	if (!orderId) {
		return json({ error: 'orderId manquant' }, { status: 400 });
	}

	await runLoyaltyCheckJob(orderId);
	return json({ received: true }, { status: 200 });
}
