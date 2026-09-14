// -----------------------------------------------------------------------------
// Fixtures pour le scénario k6 `k6/webhook.js` : des `Order` PENDING valides
// (adresse + article), rattachées à des comptes perf existants
// (`npm run seed:perf`), que le webhook Stripe peut traiter.
//
// On ne simule PAS une session Stripe Checkout réelle (hors de portée d'un
// script HTTP) : ce script crée directement, via Prisma, les lignes que
// `?/checkout` aurait produites, pour isoler la charge sur `/api/webhooks`
// (écriture de la transaction + enfilage des jobs) de tout ce qui précède.
//
// Usage :
//   npm run seed:perf                      → comptes/produits perf requis au préalable
//   node prisma/seed-webhook-fixtures.js   → écrit k6/webhook-fixtures.json
//   node prisma/seed-webhook-fixtures.js --clean → supprime les Order créées ici
// -----------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const ORDER_COUNT = Number(process.env.PERF_WEBHOOK_ORDERS ?? 200);
// Marqueur pour retrouver/nettoyer sans ambiguïté ces `Order`, sans toucher
// aux autres commandes PENDING (paniers réels abandonnés, etc.).
const MARKER_SHIPPING_OPTION = 'perf-webhook-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'k6', 'webhook-fixtures.json');

async function clean() {
	console.log('Suppression des fixtures webhook existantes…');
	await prisma.order.deleteMany({ where: { shippingOption: MARKER_SHIPPING_OPTION } });
	console.log('Nettoyage terminé.');
}

async function run() {
	const users = await prisma.user.findMany({
		where: { email: { endsWith: '@perf.test' } },
		select: { id: true, email: true, name: true },
		take: ORDER_COUNT
	});
	const products = await prisma.product.findMany({
		where: { slug: { startsWith: 'perf-product-' } },
		select: { id: true, price: true },
		take: ORDER_COUNT
	});

	if (users.length === 0 || products.length === 0) {
		console.error('Aucun compte/produit perf trouvé. Lancez `npm run seed:perf` avant ce script.');
		process.exitCode = 1;
		return;
	}

	const fixtures = [];
	const count = Math.min(ORDER_COUNT, users.length);

	for (let i = 0; i < count; i++) {
		const user = users[i % users.length];
		const product = products[i % products.length];

		const address = await prisma.address.create({
			data: {
				userId: user.id,
				first_name: 'Perf',
				last_name: 'Webhook',
				phone: '0600000000',
				street_number: '1',
				street: 'Rue de Test',
				city: 'Paris',
				county: 'Paris',
				state: 'Île-de-France',
				stateLetter: 'IDF',
				state_code: 'IDF',
				zip: '75000',
				country: 'France',
				country_code: 'FR',
				ISO_3166_1_alpha_3: 'FRA',
				type: 'SHIPPING'
			}
		});

		const order = await prisma.order.create({
			data: {
				userId: user.id,
				addressId: address.id,
				status: 'PENDING',
				subtotal: product.price,
				tax: 0,
				total: product.price,
				shippingOption: MARKER_SHIPPING_OPTION,
				shippingCost: 5,
				items: {
					create: [{ productId: product.id, quantity: 1, price: product.price }]
				}
			}
		});

		fixtures.push({
			orderId: order.id,
			amountCents: Math.round((product.price + 5) * 100),
			customerEmail: user.email,
			customerName: user.name
		});

		if ((i + 1) % 50 === 0) {
			console.log(`  fixtures : ${i + 1}/${count}`);
		}
	}

	writeFileSync(OUTPUT_PATH, JSON.stringify(fixtures, null, 2));
	console.log(`${fixtures.length} fixtures écrites dans ${OUTPUT_PATH}`);
}

const shouldClean = process.argv.includes('--clean');

(shouldClean ? clean() : run())
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
