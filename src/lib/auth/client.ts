/**
 * Client Better Auth côté navigateur — utilisé uniquement pour déclencher le
 * flux OAuth Google (POST + redirection), qu'une simple balise `<a>` ne peut
 * plus faire (voir MIGRATION_BETTER_AUTH.md). Tout le reste (connexion par
 * mot de passe, 2FA, inscription) continue de passer par de vraies actions
 * de formulaire SvelteKit, jamais ce client.
 */
import { createAuthClient } from 'better-auth/svelte';
import { twoFactorClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
	plugins: [twoFactorClient()]
});
