// -----------------------------------------------------------------------------
// Présentation du code de secours, juste après la configuration de la 2FA.
//
// Seul moment où il est lisible : Better Auth ne permet plus de relire un
// code de secours une fois chiffré en base (voir
// `auth.api.enableTwoFactor`/`$lib/auth/index.ts`). Il transite par un cookie
// éphémère posé par `/auth/2fa/setup`, lu puis effacé ici — jamais consultable
// ensuite, un nouveau code n'est délivré qu'en reconfigurant la 2FA.
// -----------------------------------------------------------------------------

import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { RECOVERY_CODE_COOKIE } from '$lib/auth/recoveryCodeCookie';

export const load = async (event: RequestEvent) => {
	if (event.locals.session === null || event.locals.user === null) {
		return redirect(302, '/auth/login');
	}
	if (!event.locals.user.emailVerified) {
		return redirect(302, '/auth/verify-email');
	}

	const recoveryCode = event.cookies.get(RECOVERY_CODE_COOKIE) ?? null;
	event.cookies.delete(RECOVERY_CODE_COOKIE, { path: '/' });

	return { recoveryCode };
};
