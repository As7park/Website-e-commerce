// -----------------------------------------------------------------------------
// Dernière étape de la réinitialisation : saisie du nouveau mot de passe.
//
// L'entrée exige une session de réinitialisation dont l'email est vérifié, et la
// 2FA validée si le compte l'exige — d'où les redirections en tête de `load`.
// La robustesse est contrôlée côté serveur : un envoi direct ne peut pas
// contourner la validation du navigateur.
//
// En sortie : ancien mot de passe remplacé (`AuthAccount`), toutes les
// sessions du compte invalidées, session de réinitialisation détruite.
// Aucune session n'est recréée automatiquement : contrairement à
// `auth.api.changePassword` (session déjà active, voir `/auth/settings`),
// il n'y a ici aucune session Better Auth à réémettre sans redemander un
// second facteur déjà validé par ce même parcours — l'utilisateur se
// reconnecte simplement avec son nouveau mot de passe.
// -----------------------------------------------------------------------------

import {
	deletePasswordResetSessionTokenCookie,
	validatePasswordResetSessionRequest
} from '$lib/auth/passwordReset';
import { invalidateUserPasswordResetSessions } from '$lib/prisma/passwordResetSession/passwordResetSession';
import { invalidateUserSessions } from '$lib/auth/session';
import { fail, redirect } from '@sveltejs/kit';
import { hashPassword, verifyPasswordStrength } from '$lib/auth/password';
import { prisma } from '$lib/server';
import { getSessionDeviceContext } from '$lib/server/deviceContext';
import { recordLoginEvent } from '$lib/prisma/loginEvent/loginEvent';

import type { Actions, RequestEvent } from './$types';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { resetPasswordSchema } from '$lib/schema/auth/resetPasswordSchema';

export const load = async (event: RequestEvent) => {
	const { session, user } = await validatePasswordResetSessionRequest(event);
	if (session === null) {
		return redirect(302, '/auth/forgot-password');
	}
	if (!session.emailVerified) {
		return redirect(302, '/auth/reset-password/verify-email');
	}
	if (user.registered2FA && !session.twoFactorVerified) {
		return redirect(302, '/auth/reset-password/2fa');
	}

	const resetPasswordForm = await superValidate(event, zod(resetPasswordSchema));
	return {
		resetPasswordForm
	};
};

export const actions: Actions = {
	resetPassword: async (event: RequestEvent) => {
		const { session: passwordResetSession, user } =
			await validatePasswordResetSessionRequest(event);
		const formData = await event.request.formData();
		const form = await superValidate(formData, zod(resetPasswordSchema));
		if (passwordResetSession === null) {
			return message(form, 'Not authenticated');
		}
		if (!passwordResetSession.emailVerified) {
			return message(form, 'Forbidden');
		}
		if (user.registered2FA && !passwordResetSession.twoFactorVerified) {
			return message(form, 'Forbidden');
		}

		// La validation Zod doit aussi s'appliquer côté serveur : sans ce contrôle,
		// un appel direct pouvait imposer un mot de passe ne respectant pas la
		// politique de robustesse.
		if (!form.valid) {
			return fail(400, { form });
		}

		const { password } = form.data;
		if (!(await verifyPasswordStrength(password))) {
			setError(
				form,
				'password',
				'Ce mot de passe est trop courant ou a fuité, choisissez-en un autre.'
			);
			return fail(400, { form });
		}

		await invalidateUserPasswordResetSessions(passwordResetSession.userId);
		await invalidateUserSessions(passwordResetSession.userId);

		const hashed = await hashPassword(password);
		await prisma.authAccount.upsert({
			where: {
				providerId_accountId: { providerId: 'credential', accountId: passwordResetSession.userId }
			},
			update: { password: hashed },
			create: {
				userId: passwordResetSession.userId,
				providerId: 'credential',
				accountId: passwordResetSession.userId,
				password: hashed
			}
		});

		// Historique, même titre qu'une connexion classique (voir
		// login/+page.server.ts) — mais jamais d'alerte « nouvel appareil » :
		// aucune session n'est ouverte ici (l'utilisateur devra se reconnecter
		// avec son nouveau mot de passe), donc rien qu'un lien « Ce n'était
		// pas moi » pourrait révoquer.
		await recordLoginEvent(user.id, 'password-reset', getSessionDeviceContext(event.request));

		deletePasswordResetSessionTokenCookie(event);
		return redirect(302, '/auth/login');
	}
};
