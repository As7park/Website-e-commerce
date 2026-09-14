// Charge sur le catalogue public : accueil, pagination `/products?page=N`,
// puis une fiche produit choisie parmi les liens réellement rendus dans la
// page (pas de slug deviné : `prisma/seed-perf.js` suffixe chaque slug d'un
// id aléatoire, imprévisible depuis l'extérieur).
//
// Prérequis : `npm run seed:perf` pour un volume réaliste (5000 produits par
// défaut). Lancer avec : `BASE_URL=http://localhost:2000 k6 run k6/catalog.js`
import http from 'k6/http';
import { check, sleep } from 'k6';
import { parseHTML } from 'k6/html';
import { BASE_URL } from './lib/config.js';

export const options = {
	scenarios: {
		catalog_browsing: {
			executor: 'ramping-vus',
			startVUs: 0,
			stages: [
				{ duration: '30s', target: 20 },
				{ duration: '1m', target: 20 },
				{ duration: '30s', target: 0 }
			]
		}
	},
	thresholds: {
		http_req_failed: ['rate<0.01'],
		http_req_duration: ['p(95)<800']
	}
};

export default function () {
	const home = http.get(`${BASE_URL}/`);
	check(home, { 'accueil 200': (r) => r.status === 200 });

	const page = Math.floor(Math.random() * 10) + 1;
	const catalog = http.get(`${BASE_URL}/products?page=${page}`);
	check(catalog, { 'catalogue 200': (r) => r.status === 200 });

	const links = parseHTML(catalog.body).find('a[href^="/products/"]');
	if (links.size() > 0) {
		const href = links.get(Math.floor(Math.random() * links.size())).attr('href');
		const detail = http.get(`${BASE_URL}${href}`);
		check(detail, { 'fiche produit 200': (r) => r.status === 200 });
	}

	sleep(1);
}
