// Charge sur `/api/webhooks` (webhook Stripe → écriture de la Transaction +
// enfilage des jobs post-paiement), sans passer par une vraie session Stripe
// Checkout (hors de portée d'un script HTTP, voir `README.md`).
//
// Chaque appel signe lui-même un évènement `checkout.session.completed`
// minimal avec `STRIPE_WEBHOOK_SECRET` (même schéma que
// `stripe.webhooks.constructEvent` côté serveur : `t=<ts>,v1=<hmac-sha256>`),
// ciblant une `Order` PENDING préparée par `prisma/seed-webhook-fixtures.js`
// (jamais une vraie session de paiement : ce script ne teste QUE le chemin
// serveur du webhook, pas Stripe lui-même).
//
// Prérequis :
//   npm run seed:perf
//   npm run seed:webhook-fixtures
// Lancer avec :
//   STRIPE_WEBHOOK_SECRET=whsec_... BASE_URL=http://localhost:2000 k6 run k6/webhook.js
import http from 'k6/http';
import crypto from 'k6/crypto';
import { check, sleep } from 'k6';
import { BASE_URL, STRIPE_WEBHOOK_SECRET } from './lib/config.js';

const fixtures = JSON.parse(open('./webhook-fixtures.json'));

export const options = {
	scenarios: {
		webhook_flow: {
			executor: 'ramping-vus',
			startVUs: 0,
			stages: [
				{ duration: '30s', target: 5 },
				{ duration: '1m', target: 5 },
				{ duration: '30s', target: 0 }
			]
		}
	},
	thresholds: {
		http_req_failed: ['rate<0.01'],
		// Plus tolérant que les autres scénarios : ce chemin fait une écriture
		// Prisma transactionnelle puis enfile 2 jobs (Sendcloud + facture).
		http_req_duration: ['p(95)<2000']
	}
};

/** Signature Stripe : `t=<timestamp>,v1=<hmac-sha256(secret, `${timestamp}.${payload}`)>`. */
function signStripePayload(payload, secret) {
	const timestamp = Math.floor(Date.now() / 1000);
	const signedPayload = `${timestamp}.${payload}`;
	const signature = crypto.hmac('sha256', secret, signedPayload, 'hex');
	return `t=${timestamp},v1=${signature}`;
}

export default function () {
	if (!STRIPE_WEBHOOK_SECRET) {
		throw new Error('STRIPE_WEBHOOK_SECRET manquant : voir k6/README.md.');
	}

	const fixture = fixtures[Math.floor(Math.random() * fixtures.length)];
	// Préfixe `perf_` : repris par le nettoyage existant de
	// `prisma/seed-perf.js --clean` (`stripePaymentId: { startsWith: 'perf_' }`).
	// Unicité via VU + itération + horodatage : pas besoin d'aléatoire cryptographique ici.
	const sessionId = `perf_wh_${__VU}_${__ITER}_${Date.now()}`;

	const event = {
		id: `evt_${sessionId}`,
		object: 'event',
		api_version: '2024-06-20',
		created: Math.floor(Date.now() / 1000),
		livemode: false,
		pending_webhooks: 0,
		request: null,
		type: 'checkout.session.completed',
		data: {
			object: {
				id: sessionId,
				object: 'checkout.session',
				amount_total: fixture.amountCents,
				currency: 'eur',
				payment_status: 'paid',
				created: Math.floor(Date.now() / 1000),
				customer_details: {
					email: fixture.customerEmail,
					name: fixture.customerName,
					phone: '0600000000'
				},
				metadata: { order_id: fixture.orderId }
			}
		}
	};

	const payload = JSON.stringify(event);
	const signature = signStripePayload(payload, STRIPE_WEBHOOK_SECRET);

	const res = http.post(`${BASE_URL}/api/webhooks`, payload, {
		headers: {
			'Content-Type': 'application/json',
			'stripe-signature': signature
		}
	});

	check(res, { 'webhook accepté (200)': (r) => r.status === 200 });

	sleep(1);
}
