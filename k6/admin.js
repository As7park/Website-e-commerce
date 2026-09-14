// Charge sur les listings admin, plus coûteux côté DB (recherche, tri,
// pagination sur des tables volumineuses) : connexion avec le compte admin
// de démo (`prisma/seed.js`), puis pagination sur `/admin/users`,
// `/admin/sales`, `/admin/products`.
//
// Prérequis : `npm run seed` (compte admin) + `npm run seed:perf` (volume).
// Lancer avec : `BASE_URL=http://localhost:2000 k6 run k6/admin.js`
//
// VUs volontairement bas : un seul compte admin partagé entre tous les VUs
// (comme en usage réel), pas la peine de simuler des dizaines d'admins.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } from './lib/config.js';
import { login } from './lib/auth.js';

export const options = {
	scenarios: {
		admin_listings: {
			executor: 'ramping-vus',
			startVUs: 0,
			stages: [
				{ duration: '20s', target: 5 },
				{ duration: '1m', target: 5 },
				{ duration: '20s', target: 0 }
			]
		}
	},
	thresholds: {
		http_req_failed: ['rate<0.01'],
		http_req_duration: ['p(95)<1500']
	}
};

// Une connexion par VU (pas par itération) : le but est de charger les
// listings, pas de re-mesurer le parcours de connexion (voir k6/login.js
// pour ça) — une variable de module est réévaluée à chaque VU par k6, donc
// persistante entre les itérations d'un même VU.
let loggedIn = false;

export default function () {
	if (!loggedIn) {
		const res = login(ADMIN_EMAIL, ADMIN_PASSWORD);
		check(res, { 'connexion admin aboutit sur une page 200': (r) => r.status === 200 });
		loggedIn = true;
	}

	const page = Math.floor(Math.random() * 10) + 1;

	const users = http.get(`${BASE_URL}/admin/users?page=${page}`);
	check(users, { '/admin/users 200': (r) => r.status === 200 });

	const sales = http.get(`${BASE_URL}/admin/sales?page=${page}`);
	check(sales, { '/admin/sales 200': (r) => r.status === 200 });

	const products = http.get(`${BASE_URL}/admin/products?page=${page}`);
	check(products, { '/admin/products 200': (r) => r.status === 200 });

	sleep(1);
}
