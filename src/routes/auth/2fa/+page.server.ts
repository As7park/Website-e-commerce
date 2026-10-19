// -----------------------------------------------------------------------------
// Validation du second facteur pour la connexion en cours.
//
// Page imposée par `/auth/login` quand le compte exige la 2FA : Better Auth
// n'a alors créé aucune session, seul un cookie signé éphémère («
// two_factor ») identifie le compte en attente de vérification (voir
// MIGRATION_BETTER_AUTH.md). Un code valide crée la session définitive.
// -----------------------------------------------------------------------------

import { redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/auth';
import { applyAuthCookies, TWO_FACTOR_PENDING_COOKIE } from '#lib/auth/cookies';
import { finalizeLogin } from '#lib/auth/finalizeLogin';
import { ExpiringTokenBucket } from '#lib/server/rate-limit';

import type { Actions, RequestEvent } from './$types';
import { zod } from 'sveltekit-superforms/adapters';
import { message, superValidate } from 'sveltekit-superforms';
import { totpCodeSchema } from '#lib/schema/auth/totpCodeSchema';

// Par IP, pas par compte : l'identité n'est connue que du cookie signé
// « two_factor » que Better Auth lit lui-même, jamais exposé ici (voir
// commentaire de tête). Better Auth verrouille aussi le compte après 5
// échecs consécutifs sur un même défi, indépendamment de ce quota.
const totpBucket = new ExpiringTokenBucket<string>(5, 60 * 30, '2fa-totp');

export const load = async (event: RequestEvent) => {
	// Déjà pleinement connecté : sous Better Auth, ça veut dire que la 2FA
	// (si exigée) est déjà passée — rien à faire ici.
	if (event.locals.session !== null && event.locals.user !== null) {
		if (!event.locals.user.emailVerified) {
			return redirect(302, '/auth/verify-email');
		}
		return redirect(302, '/auth/');
	}
	// Ni session ni défi 2FA en attente : visiteur anonyme, jamais passé par
	// `/auth/login` — rien à faire ici.
	if (!event.cookies.get(TWO_FACTOR_PENDING_COOKIE)) {
		return redirect(302, '/auth/login');
	}
	const totpForm = await superValidate(event, zod(totpCodeSchema));
	return { totpForm };
};

export const actions: Actions = {
	totp: async (event: RequestEvent) => {
		const formData = await event.request.formData();
		const form = await superValidate(formData, zod(totpCodeSchema));

		if (!form.valid) {
			return message(form, 'Invalid data');
		}

		const code = formData.get('code');
		if (typeof code !== 'string' || code === '') {
			return message(form, 'Please enter your code');
		}

		// Débit par IP (pas par compte : l'identité n'est connue que du cookie
		// signé « two_factor », jamais lu directement ici).
		const ip = event.request.headers.get('x-forwarded-for') ?? 'localhost';
		if (!(await totpBucket.check(ip, 1))) {
			return message(form, 'Too many requests');
		}
		if (!(await totpBucket.consume(ip, 1))) {
			return message(form, 'Too many requests');
		}

		let authHeaders: Headers | undefined;
		let response: Awaited<ReturnType<typeof auth.api.verifyTOTP>>;
		try {
			const result = await auth.api.verifyTOTP({
				body: { code },
				headers: event.request.headers,
				returnHeaders: true
			});
			authHeaders = result.headers;
			response = result.response;
		} catch (error) {
			if (error instanceof APIError) {
				return message(form, 'Invalid TOTP code', { status: 400 });
			}
			throw error;
		}

		applyAuthCookies(event, authHeaders);
		await totpBucket.reset(ip);

		await finalizeLogin(event.request, {
			userId: response.user.id,
			email: response.user.email,
			token: response.token,
			method: 'password'
		});

		redirect(302, '/auth/');
	}
};
