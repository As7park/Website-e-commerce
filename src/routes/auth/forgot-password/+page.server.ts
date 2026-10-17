// -----------------------------------------------------------------------------
// Demande de réinitialisation de mot de passe.
//
// Ouvre une session de réinitialisation et envoie un code par email. Cette
// session part toujours sans aucun droit acquis (`twoFactorVerified = false`) :
// un compte protégé par 2FA devra la valider avant de changer son mot de passe,
// sinon la 2FA serait contournable par un simple accès à la boîte mail.
// -----------------------------------------------------------------------------

import { prisma } from '$lib/server';
import {
	createPasswordResetSession,
	sendPasswordResetEmail,
	setPasswordResetSessionTokenCookie
} from '$lib/auth/passwordReset';
import { invalidateUserPasswordResetSessions } from '$lib/prisma/passwordResetSession/passwordResetSession';
import { RefillingTokenBucket } from '$lib/server/rate-limit';
import { fail, redirect } from '@sveltejs/kit';

import type { Actions, RequestEvent } from './$types';
import { message, superValidate } from 'sveltekit-superforms';
import { forgotPasswordSchema } from '$lib/schema/auth/forgotPasswordSchema';
import { zod } from 'sveltekit-superforms/adapters';

const ipBucket = new RefillingTokenBucket<string>(3, 60, 'forgot-password-ip');
// La clé est l'identifiant utilisateur, devenu un cuid avec PostgreSQL.
const userBucket = new RefillingTokenBucket<string>(3, 60, 'forgot-password-user');

export const load = async (event) => {
	if (event.locals.session !== null && event.locals.user !== null) {
		return redirect(302, '/auth/');
	}

	const forgotForm = await superValidate(event, zod(forgotPasswordSchema));

	return {
		forgotForm
	};
};

export const actions: Actions = {
	forgotPassword: async (event: RequestEvent) => {
		// TODO: Assumes X-Forwarded-For is always included.
		const formData = await event.request.formData();
		const form = await superValidate(formData, zod(forgotPasswordSchema));
		const { email } = form.data;
		if (!form.valid) {
			return fail(400, { form });
		}

		const clientIP = event.request.headers.get('X-Forwarded-For');
		if (clientIP !== null && !(await ipBucket.check(clientIP, 1))) {
			return message(form, 'Too many requests');
		}

		const user = await prisma.user.findUnique({ where: { email } });

		if (user === null) {
			return message(form, 'Account does not exist');
		}
		if (clientIP !== null && !(await ipBucket.consume(clientIP, 1))) {
			return message(form, 'Too many requests');
		}

		if (!(await userBucket.consume(user.id, 1))) {
			return message(form, 'Too many requests');
		}

		await invalidateUserPasswordResetSessions(user.id);
		const session = await createPasswordResetSession(user.id, user.email);

		await sendPasswordResetEmail(session.email, session.code);

		setPasswordResetSessionTokenCookie(event, session.id, session.expiresAt);

		return redirect(302, '/auth/reset-password/verify-email');
	}
};
