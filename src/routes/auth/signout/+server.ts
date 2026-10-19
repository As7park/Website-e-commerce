// -----------------------------------------------------------------------------
// Déconnexion (POST).
//
// Conservé pour les appels programmatiques. Le tiroir panier passe par l'action
// `/auth?/signout` (formulaire), qui gère CSRF et la redirection.
// -----------------------------------------------------------------------------

import type { RequestHandler } from './$types';
import { auth } from '#lib/auth';
import { applyAuthCookies } from '#lib/auth/cookies';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.session) {
		return new Response(JSON.stringify({ message: 'Not authenticated' }), { status: 401 });
	}

	const { headers } = await auth.api.signOut({
		headers: event.request.headers,
		returnHeaders: true
	});
	applyAuthCookies(event, headers);

	return new Response(JSON.stringify({ success: true }), { status: 200 });
};
