// -----------------------------------------------------------------------------
// Configuration de la double authentification.
//
// Une clé TOTP est tirée à chaque affichage de la page (via
// `enableTwoFactorDirect`) et présentée en QR code ; elle n'est activée
// qu'une fois un code valide saisi (`auth.api.verifyTOTP`), preuve que
// l'application de l'utilisateur la partage réellement.
//
// `enableTwoFactorDirect` plutôt que `auth.api.enableTwoFactor` : ce dernier
// exige le mot de passe actuel dès que le compte en a un, ce qui aurait
// changé l'UX existante (jamais de mot de passe demandé ici avant la
// migration) — voir `#lib/auth/twoFactor.ts` pour le détail.
//
// Le code de secours délivré au même instant (un seul, voir
// `RECOVERY_CODE_LENGTH` dans `#lib/auth/twoFactor.ts`) n'est jamais
// réaffiché ensuite : il transite par un cookie éphémère jusqu'à
// `/auth/recovery-code`, qui le consomme et l'efface.
// -----------------------------------------------------------------------------

import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/auth';
import { applyAuthCookies } from '#lib/auth/cookies';
import { enableTwoFactorDirect } from '#lib/auth/twoFactor';
import { RefillingTokenBucket } from '#lib/server/rate-limit';
import { message, superValidate } from 'sveltekit-superforms';
import { totpSchema } from '#lib/schema/auth/totpSchema';
import { renderSVG } from 'uqr';
import { RECOVERY_CODE_COOKIE } from '#lib/auth/recoveryCodeCookie';

import type { Actions, RequestEvent } from './$types';
import { zod } from 'sveltekit-superforms/adapters';

const totpUpdateBucket = new RefillingTokenBucket<string>(3, 60 * 10, '2fa-setup');

export const load = async (event: RequestEvent) => {
	if (event.locals.session === null || event.locals.user === null) {
		return redirect(302, '/auth/login');
	}
	if (!event.locals.user.emailVerified) {
		return redirect(302, '/auth/verify-email');
	}
	// Déjà configurée : rien à refaire ici (voir /auth/settings pour
	// retirer/reconfigurer la 2FA).
	if (event.locals.user.registered2FA) {
		return redirect(302, '/auth/settings');
	}

	const accountLabel = event.locals.user.username ?? event.locals.user.email;
	const { totpURI, recoveryCode, encodedTOTPKey } = await enableTwoFactorDirect(
		event.locals.user.id,
		accountLabel
	);

	const qrcode = renderSVG(totpURI);

	event.cookies.set(RECOVERY_CODE_COOKIE, recoveryCode, {
		httpOnly: true,
		maxAge: 60 * 10,
		secure: import.meta.env.PROD,
		path: '/',
		sameSite: 'lax'
	});

	const totpForm = await superValidate(event, zod(totpSchema));

	return {
		encodedTOTPKey,
		qrcode,
		totpForm
	};
};

export const actions: Actions = {
	setuptotp: async (event: RequestEvent) => {
		const formData = await event.request.formData();
		const form = await superValidate(formData, zod(totpSchema));

		if (event.locals.session === null || event.locals.user === null) {
			return message(form, 'Not authenticated');
		}
		if (!event.locals.user.emailVerified) {
			return message(form, 'Email not verified');
		}
		if (event.locals.user.registered2FA) {
			return message(form, 'Two-factor already set up');
		}
		if (!(await totpUpdateBucket.check(event.locals.user.id, 1))) {
			return message(form, 'Too many requests');
		}

		if (!form.valid) {
			return message(form, 'Form validation failed');
		}

		const { code } = form.data;

		try {
			const { headers: authHeaders } = await auth.api.verifyTOTP({
				body: { code },
				headers: event.request.headers,
				returnHeaders: true
			});
			applyAuthCookies(event, authHeaders);
		} catch (error) {
			if (error instanceof APIError) {
				return message(form, 'Invalid TOTP code');
			}
			return fail(500, { message: 'Internal server error', form });
		}

		return redirect(303, '/auth/recovery-code');
	}
};
