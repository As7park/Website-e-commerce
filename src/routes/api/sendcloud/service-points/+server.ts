import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { withCircuitBreaker, CircuitOpenError } from '$lib/server/circuit-breaker';
import { log } from '$lib/server/log';

const requestSchema = z.object({
	to_country_code: z.string(), // ex: "FR"
	to_postal_code: z.string(), // ex: "31500"
	radius: z.number().default(20000), // Rayon en mètres
	carriers: z.string().optional() // ex: "colisprive"
});

/** Même garde-fou que `shipping-options/+server.ts` (10s) : sans ça, une
 * réponse Sendcloud qui traîne bloque la requête indéfiniment. */
async function fetchWithTimeout(url: string, init: RequestInit, ms = 10_000) {
	const controller = new AbortController();
	const t = setTimeout(() => controller.abort(), ms);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(t);
	}
}

export async function POST({ request }) {
	// 1️⃣ Lire et valider le JSON reçu
	const payload = await request.json();
	const parseResult = requestSchema.safeParse(payload);
	if (!parseResult.success) {
		return json(
			{ message: 'Invalid request body', issues: parseResult.error.issues },
			{ status: 400 }
		);
	}

	const { to_country_code, to_postal_code, radius, carriers } = parseResult.data;

	// 2️⃣ Authentification Sendcloud (Basic Auth)
	const authString = `${process.env.SENDCLOUD_PUBLIC_KEY}:${process.env.SENDCLOUD_SECRET_KEY}`;
	const base64Auth = Buffer.from(authString).toString('base64');

	// 3️⃣ Construire l'URL de requête à Sendcloud
	const spUrl = new URL('https://servicepoints.sendcloud.sc/api/v2/service-points');
	spUrl.searchParams.set('country', to_country_code);
	spUrl.searchParams.set('address', to_postal_code);
	spUrl.searchParams.set('radius', String(radius));

	if (carriers) {
		spUrl.searchParams.set('carriers', carriers);
	}

	// 4️⃣ Envoyer la requête à Sendcloud, sous disjoncteur + timeout (même
	// protection que `shipping-options/+server.ts` et `post-payment.ts`).
	let response: Response;
	try {
		response = await withCircuitBreaker('sendcloud', () =>
			fetchWithTimeout(spUrl.toString(), {
				method: 'GET',
				headers: {
					Authorization: `Basic ${base64Auth}`,
					Accept: 'application/json'
				}
			})
		);
	} catch (err) {
		if (err instanceof CircuitOpenError) {
			log('WARN', 'sendcloud:service-points', 'Disjoncteur ouvert, appel court-circuité');
			throw error(
				503,
				'Service de points relais temporairement indisponible, réessayez dans une minute.'
			);
		}
		if (err instanceof DOMException && err.name === 'AbortError') {
			log('WARN', 'sendcloud:service-points', 'Délai dépassé en contactant Sendcloud');
			throw error(504, 'Le service de points relais met trop de temps à répondre.');
		}
		log('ERROR', 'sendcloud:service-points', 'Erreur réseau vers Sendcloud', err);
		throw error(502, 'Impossible de contacter le service de points relais.');
	}

	// 5️⃣ Gérer les erreurs éventuelles — jamais le texte brut de Sendcloud au
	// client (fuite d'information potentielle), toujours loggé côté serveur.
	if (!response.ok) {
		const raw = await response.text().catch(() => '');
		log('ERROR', 'sendcloud:service-points', `Sendcloud a répondu ${response.status}`, raw);
		throw error(response.status, 'Le service de points relais a renvoyé une erreur.');
	}

	// 6️⃣ Convertir la réponse et la renvoyer au client
	const servicePointsData = await response.json();
	return json(servicePointsData);
}
