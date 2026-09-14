// Charge sur le parcours de connexion : GET du formulaire, POST
// `?/login`, puis une requête sur une page qui nécessite la session pour
// vérifier que le cookie posé par la connexion est bien réutilisé (k6 a un
// cookie jar par VU, comme un navigateur).
//
// Prérequis : `npm run seed:perf` (comptes `perf-user-{0..N-1}@perf.test`,
// mot de passe `PerfSeed!2026` — voir prisma/seed-perf.js).
// Lancer avec : `BASE_URL=http://localhost:2000 k6 run k6/login.js`
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, PERF_USER_COUNT, PERF_PASSWORD } from './lib/config.js';
import { login } from './lib/auth.js';

export const options = {
	scenarios: {
		login_flow: {
			executor: 'ramping-vus',
			startVUs: 0,
			stages: [
				{ duration: '30s', target: 10 },
				{ duration: '1m', target: 10 },
				{ duration: '30s', target: 0 }
			]
		}
	},
	thresholds: {
		http_req_failed: ['rate<0.01'],
		http_req_duration: ['p(95)<1000']
	}
};

export default function () {
	const email = `perf-user-${Math.floor(Math.random() * PERF_USER_COUNT)}@perf.test`;

	const loginPage = http.get(`${BASE_URL}/auth/login`);
	check(loginPage, { 'page de connexion 200': (r) => r.status === 200 });

	const res = login(email, PERF_PASSWORD);
	check(res, { 'connexion aboutit sur une page 200': (r) => r.status === 200 });

	// Le compte perf est vérifié/sans MFA (seed-perf.js) : la connexion
	// redirige vers `/`, réutilisée ici avec le cookie de session du jar VU.
	const account = http.get(`${BASE_URL}/`);
	check(account, { 'page accessible après connexion': (r) => r.status === 200 });

	sleep(1);
}
