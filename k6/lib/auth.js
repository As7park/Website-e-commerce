// Connexion e-mail/mot de passe par formulaire HTML brut (comme un
// navigateur sans JS) : POST url-encoded sur `?/login`, en-tête `Origin`
// obligatoire car la protection CSRF par défaut de SvelteKit
// (`checkOrigin`, voir src/hooks.server.ts) rejette sinon la requête en 403.
// Ne PAS ajouter `X-Forwarded-For` : ça déclencherait le quota par IP
// (`$lib/server/rate-limit.ts`) bien plus vite que prévu pour un test de
// charge multi-VU derrière une seule IP sortante.
import http from 'k6/http';
import { BASE_URL } from './config.js';

export function login(email, password) {
	return http.post(`${BASE_URL}/auth/login?/login`, { email, password }, {
		headers: { Origin: BASE_URL },
		redirects: 5
	});
}
