// -----------------------------------------------------------------------------
// Connexion par email et mot de passe.
//
// Deux garde-fous se cumulent : un quota par adresse IP, et un délai croissant
// par compte après chaque échec. Les messages d'erreur ne distinguent jamais un
// compte inconnu d'un mot de passe erroné, pour ne pas révéler quelles adresses
// sont inscrites.
//
// La vérification du mot de passe est entièrement déléguée à
// `auth.api.signInEmail` (Better Auth) : si le compte exige la 2FA, aucune
// session n'est créée ici — seul un cookie signé éphémère l'est, lu par
// `/auth/2fa` à la soumission du code (voir MIGRATION_BETTER_AUTH.md).
// -----------------------------------------------------------------------------

import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { prisma } from '$lib/server';
import { auth } from '$lib/auth';
import { applyAuthCookies } from '$lib/auth/cookies';
import { finalizeLogin } from '$lib/auth/finalizeLogin';
import { RefillingTokenBucket, Throttler } from '$lib/server/rate-limit';
import { reportFailedLoginAttempt } from '$lib/server/failedLoginAlert';
import { getSessionDeviceContext } from '$lib/server/deviceContext';

import type { Actions, PageServerLoadEvent, RequestEvent } from './$types';
import { loginSchema } from '$lib/schema/auth/loginSchema';
import { zod } from 'sveltekit-superforms/adapters';
import { message, superValidate } from 'sveltekit-superforms';

export const load = async (event: PageServerLoadEvent) => {
	// Déjà connecté : il ne reste qu'à l'orienter. Les étapes de 2FA sont déjà
	// imposées en amont par `authHandle`, seule la vérification d'adresse est à
	// contrôler ici.
	if (event.locals.session !== null && event.locals.user !== null) {
		if (!event.locals.user.emailVerified) {
			return redirect(302, '/auth/verify-email');
		}
		return redirect(302, '/auth/');
	}

	const loginForm = await superValidate(event, zod(loginSchema));

	return {
		loginForm
	};
};

// La clé est l'identifiant utilisateur, devenu un cuid avec PostgreSQL.
const throttler = new Throttler<string>([0, 1, 2, 4, 8, 16, 30, 60, 180, 300], 'login-throttle');
const ipBucket = new RefillingTokenBucket<string>(20, 1, 'login-ip');

export const actions: Actions = {
	login: async (event: RequestEvent) => {
		// TODO: Assumes X-Forwarded-For is always included.
		const clientIP = event.request.headers.get('X-Forwarded-For');
		if (clientIP !== null && !(await ipBucket.check(clientIP, 1))) {
			return fail(429, {
				message: 'Too many requests',
				email: ''
			});
		}

		const form = await superValidate(event, zod(loginSchema));
		const { email, password } = form.data;

		if (!form.valid) {
			return fail(400, { form });
		}

		// Lecture directe : il faut `user.id` pour le throttler et `googleId`
		// pour la branche OAuth AVANT même de tenter la vérification du mot de
		// passe (déléguée à `auth.api.signInEmail` ci-dessous).
		const user = await prisma.user.findUnique({ where: { email } });

		if (user === null) {
			return message(form, 'Le compte nexiste pas');
		}

		// Si l'utilisateur possède un googleId, c'est un utilisateur OAuth
		if (user.googleId) {
			return message(form, 'Connectez vous via Google OAuth');
		}

		if (clientIP !== null && !(await ipBucket.consume(clientIP, 1))) {
			return message(form, 'Too many requests');
		}
		if (!(await throttler.consume(user.id))) {
			return message(form, 'Too many requests');
		}

		let authHeaders: Headers | undefined;
		let response: Awaited<ReturnType<typeof auth.api.signInEmail>>;
		try {
			const result = await auth.api.signInEmail({
				body: { email, password },
				headers: event.request.headers,
				returnHeaders: true
			});
			authHeaders = result.headers;
			response = result.response;
		} catch (error) {
			if (error instanceof APIError) {
				await reportFailedLoginAttempt(user.id, user.email, getSessionDeviceContext(event.request));
				return message(form, 'Invalid password');
			}
			throw error;
		}
		await throttler.reset(user.id);
		applyAuthCookies(event, authHeaders);

		// Le type inféré de `signInEmail` ne porte pas la variante « 2FA
		// requise » (elle dépend du plugin, pas de la signature générique) —
		// vérifiée ainsi plutôt que castée en dur.
		if ('twoFactorRedirect' in response && response.twoFactorRedirect) {
			redirect(302, '/auth/2fa');
		}

		const sessionUser = response.user;
		await finalizeLogin(event.request, {
			userId: sessionUser.id,
			email: sessionUser.email,
			token: response.token,
			method: 'password'
		});

		if (!sessionUser.emailVerified) {
			return redirect(302, '/auth/verify-email');
		}

		redirect(302, '/');
	}
};
