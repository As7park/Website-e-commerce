// -----------------------------------------------------------------------------
// Tableau de bord du compte.
//
// Point d'arrivée de tous les parcours réussis. Son `load` refuse tout état
// intermédiaire (adresse non vérifiée) et redirige vers l'étape qui manque,
// ce qui en fait aussi la porte d'entrée naturelle de l'espace compte.
//
// La 2FA n'a plus d'état intermédiaire à vérifier ici : sous Better Auth, une
// session n'existe que si le second facteur (quand exigé) a déjà été validé
// (voir MIGRATION_BETTER_AUTH.md).
// -----------------------------------------------------------------------------

import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/auth';
import { applyAuthCookies } from '$lib/auth/cookies';

import type { Actions, PageServerLoadEvent, RequestEvent } from './$types';

export const load = async (event: PageServerLoadEvent) => {
	if (event.locals.session === null || event.locals.user === null) {
		return redirect(302, '/auth/login');
	}
	if (!event.locals.user.emailVerified) {
		return redirect(302, '/auth/verify-email');
	}

	return {
		user: {
			username: event.locals.user.username,
			email: event.locals.user.email,
			role: event.locals.user.role,
			isMfaEnabled: event.locals.user.isMfaEnabled,
			registered2FA: event.locals.user.registered2FA
		}
	};
};

export const actions: Actions = {
	signout: async (event: RequestEvent) => {
		if (event.locals.session === null) {
			return redirect(302, '/');
		}

		const { headers } = await auth.api.signOut({
			headers: event.request.headers,
			returnHeaders: true
		});
		applyAuthCookies(event, headers);
		event.locals.session = null;
		event.locals.user = null;

		// Ramène à l'accueil plutôt qu'à /auth/login : ce formulaire est aussi
		// soumis depuis le tiroir panier, sur n'importe quelle page.
		return redirect(302, '/');
	}
};
