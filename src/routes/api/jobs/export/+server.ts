import { json } from '@sveltejs/kit';
import { getQStashReceiver } from '$lib/server/qstash';
import { runExportJob, type ExportKind } from '$lib/server/jobs/export';

/**
 * Appelé par QStash (`$lib/server/qstash.ts` → `enqueueExportJob`), jamais
 * directement par un client. Même garde de signature que
 * `/api/jobs/post-payment` et `/api/jobs/invoice-email`.
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

	const { kind, requestedByEmail } = JSON.parse(body) as {
		kind?: ExportKind;
		requestedByEmail?: string;
	};

	if (kind !== 'sales' && kind !== 'users') {
		return json({ error: 'kind invalide' }, { status: 400 });
	}
	if (!requestedByEmail) {
		return json({ error: 'requestedByEmail manquant' }, { status: 400 });
	}

	await runExportJob(kind, requestedByEmail);
	return json({ received: true }, { status: 200 });
}
