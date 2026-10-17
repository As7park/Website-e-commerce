// -----------------------------------------------------------------------------
// Réinitialisation, étape 2 : second facteur.
//
// Deux issues possibles : un code TOTP, ou le code de secours si l'application
// d'authentification est perdue. Ce dernier retire la 2FA du compte, ce qui rend
// l'étape suivante accessible sans second facteur.
//
// Aucune session Better Auth n'existe à ce stade (l'utilisateur n'est pas
// connecté, seulement en train de réinitialiser son mot de passe) : la
// vérification se fait directement contre `TwoFactor` (voir
// `$lib/auth/twoFactor.ts`), pas via `auth.api.verifyTOTP`/`verifyBackupCode`.
// -----------------------------------------------------------------------------

import { validatePasswordResetSessionRequest } from '$lib/auth/passwordReset';
import { setPasswordResetSessionAs2FAVerified } from '$lib/prisma/passwordResetSession/passwordResetSession';
import { verifyAndConsumeRecoveryCodeDirect, verifyTotpCodeDirect } from '$lib/auth/twoFactor';
import { ExpiringTokenBucket } from '$lib/server/rate-limit';
import { redirect } from '@sveltejs/kit';

import type { Actions, RequestEvent } from './$types';
import { recoveryCodeSchema } from '$lib/schema/auth/recoveryCodeSchema';
import { totpCodeSchema } from '$lib/schema/auth/totpCodeSchema';
import { zod } from 'sveltekit-superforms/adapters';
import { message, superValidate } from 'sveltekit-superforms';

const totpBucket = new ExpiringTokenBucket<string>(5, 60 * 30, 'reset-password-2fa-totp');
const recoveryCodeBucket = new ExpiringTokenBucket<string>(
	3,
	60 * 60,
	'reset-password-2fa-recovery'
);

export const load = async (event: RequestEvent) => {
	const { session, user } = await validatePasswordResetSessionRequest(event);

	if (session === null) {
		return redirect(302, '/auth/forgot-password');
	}
	if (!session.emailVerified) {
		return redirect(302, '/auth/reset-password/verify-email');
	}
	if (!user.registered2FA) {
		return redirect(302, '/auth/reset-password');
	}
	if (session.twoFactorVerified) {
		return redirect(302, '/auth/reset-password');
	}
	const totpForm = await superValidate(event, zod(totpCodeSchema));
	const recoveryCodeForm = await superValidate(event, zod(recoveryCodeSchema));

	return {
		totpForm,
		recoveryCodeForm
	};
};

export const actions: Actions = {
	totp: totpAction,
	recovery_code: recoveryCodeAction
};

async function totpAction(event: RequestEvent) {
	const { session, user } = await validatePasswordResetSessionRequest(event);

	const formData = await event.request.formData();

	const form = await superValidate(formData, zod(totpCodeSchema));

	if (session === null) {
		return message(form, 'Not authenticated');
	}
	if (!session.emailVerified || !user.registered2FA || session.twoFactorVerified) {
		return message(form, 'Forbidden');
	}
	if (!(await totpBucket.check(session.userId, 1))) {
		return message(form, 'Too many requests');
	}

	const code = formData.get('code');
	if (typeof code !== 'string') {
		return message(form, 'Invalid or missing fields');
	}
	if (code === '') {
		return message(form, 'Please enter your code');
	}
	if (!(await totpBucket.consume(session.userId, 1))) {
		return message(form, 'Too many requests');
	}

	const isValid = await verifyTotpCodeDirect(session.userId, code);
	if (!isValid) {
		return message(form, 'Invalid TOTP code');
	}

	await totpBucket.reset(session.userId);
	await setPasswordResetSessionAs2FAVerified(session.id);
	redirect(302, '/auth/reset-password');
}

async function recoveryCodeAction(event: RequestEvent) {
	const { session, user } = await validatePasswordResetSessionRequest(event);
	const formData = await event.request.formData();

	const form = await superValidate(formData, zod(recoveryCodeSchema));

	if (session === null) {
		return message(form, 'Not authenticated');
	}
	if (!session.emailVerified || !user.registered2FA || session.twoFactorVerified) {
		return message(form, 'Forbidden');
	}

	if (!(await recoveryCodeBucket.check(session.userId, 1))) {
		return message(form, 'Too many requests');
	}

	const { code } = form.data;

	if (typeof code !== 'string') {
		return message(form, 'Invalid or missing fields');
	}
	if (code === '') {
		return message(form, 'Please enter your code');
	}
	if (!(await recoveryCodeBucket.consume(session.userId, 1))) {
		return message(form, 'Too many requests');
	}

	const valid = await verifyAndConsumeRecoveryCodeDirect(session.userId, code);

	if (!valid) {
		return message(form, 'Invalid code');
	}

	await recoveryCodeBucket.reset(session.userId);
	await setPasswordResetSessionAs2FAVerified(session.id);

	redirect(302, '/auth/reset-password');
}
