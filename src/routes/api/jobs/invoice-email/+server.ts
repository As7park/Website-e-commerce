import { json } from '@sveltejs/kit';
import { getQStashReceiver } from '$lib/server/qstash';
import { runInvoiceEmailJob } from '$lib/server/jobs/invoice-email';

/**
 * Appelé par QStash (`$lib/server/qstash.ts` → `enqueueInvoiceEmailJob`),
 * jamais directement par un client — même garde de signature que
 * `/api/jobs/post-payment`, dont ce job a été séparé pour ne pas coupler un
 * pic SMTP à la disponibilité de Sendcloud.
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

	const { transactionId } = JSON.parse(body) as { transactionId?: string };
	if (!transactionId) {
		return json({ error: 'transactionId manquant' }, { status: 400 });
	}

	await runInvoiceEmailJob(transactionId);
	return json({ received: true }, { status: 200 });
}
