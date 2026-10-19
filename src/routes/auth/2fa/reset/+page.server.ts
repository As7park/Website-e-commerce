// -----------------------------------------------------------------------------
// Perte de l'application d'authentification : usage du code de secours.
//
// Le code accepté connecte le compte (comme `/auth/2fa`) ET retire la clé
// TOTP — un seul code de secours existe par compte (voir
// `backupCodeOptions` dans `#lib/auth/index.ts`), l'utiliser est donc
// nécessairement une sortie définitive de la 2FA actuelle, jamais une
// simple connexion. L'utilisateur est renvoyé vers sa (re)configuration,
// toujours exigée sur son compte.
// -----------------------------------------------------------------------------

import { redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/auth';
import { applyAuthCookies, TWO_FACTOR_PENDING_COOKIE } from '#lib/auth/cookies';
import { disableTwoFactor } from '#lib/auth/twoFactor';
import { finalizeLogin } from '#lib/auth/finalizeLogin';
import { prisma } from '#lib/server';
import { ExpiringTokenBucket } from '#lib/server/rate-limit';

import type { Actions, RequestEvent } from './$types';
import { message, superValidate } from 'sveltekit-superforms';
import { recoveryCodeSchema } from '#lib/schema/auth/recoveryCodeSchema';
import { zod } from 'sveltekit-superforms/adapters';

// Par IP, même raison que `/auth/2fa` (`totpBucket`).
const recoveryCodeBucket = new ExpiringTokenBucket<string>(3, 60 * 60, '2fa-recovery-code');

export const load = async (event: RequestEvent) => {
	if (event.locals.session !== null && event.locals.user !== null) {
		return redirect(302, '/auth/');
	}
	// Ni session ni défi 2FA en attente : visiteur anonyme, jamais passé par
	// `/auth/login` — rien à faire ici.
	if (!event.cookies.get(TWO_FACTOR_PENDING_COOKIE)) {
		return redirect(302, '/auth/login');
	}
	const verifyCodeForm = await superValidate(event, zod(recoveryCodeSchema));
	return { verifyCodeForm };
};

export const actions: Actions = {
	recovery_code: async (event: RequestEvent) => {
		const formData = await event.request.formData();
		const form = await superValidate(formData, zod(recoveryCodeSchema));

		const code = formData.get('code');
		if (typeof code !== 'string' || code === '') {
			return message(form, 'Please enter your code');
		}

		const ip = event.request.headers.get('x-forwarded-for') ?? 'localhost';
		if (!(await recoveryCodeBucket.check(ip, 1))) {
			return message(form, 'Too many requests');
		}
		if (!(await recoveryCodeBucket.consume(ip, 1))) {
			return message(form, 'Too many requests');
		}

		let authHeaders: Headers | undefined;
		let response: Awaited<ReturnType<typeof auth.api.verifyBackupCode>>;
		try {
			const result = await auth.api.verifyBackupCode({
				body: { code },
				headers: event.request.headers,
				returnHeaders: true
			});
			authHeaders = result.headers;
			response = result.response;
		} catch (error) {
			if (error instanceof APIError) {
				return message(form, 'Invalid recovery code');
			}
			throw error;
		}

		applyAuthCookies(event, authHeaders);
		await recoveryCodeBucket.reset(ip);

		await finalizeLogin(event.request, {
			userId: response.user.id,
			email: response.user.email,
			token: response.token,
			method: 'password'
		});

		await disableTwoFactor(response.user.id);

		// La 2FA vient d'être retirée : l'utilisateur doit la reconfigurer si
		// elle reste exigée sur le compte, sinon il peut rejoindre son espace
		// directement. Relu en base : le type renvoyé par `verifyBackupCode`
		// n'expose pas nos champs additionnels (`isMfaEnabled`).
		const freshUser = await prisma.user.findUnique({
			where: { id: response.user.id },
			select: { isMfaEnabled: true }
		});
		if (freshUser?.isMfaEnabled) {
			return redirect(302, '/auth/2fa/setup');
		}
		return redirect(302, '/auth/');
	}
};
