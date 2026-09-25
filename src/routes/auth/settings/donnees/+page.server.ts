/**
 * Mes données (RGPD) — export (portabilité, art. 20) et suppression
 * (effacement, art. 17) en self-service, depuis le compte lui-même plutôt
 * que par un canal de contact.
 *
 * La suppression n'efface jamais physiquement le compte : elle l'anonymise
 * (`$lib/prisma/user/anonymizeUser.ts`) — `Order`/`Transaction` sont
 * légalement conservés (obligation comptable), seuls les champs
 * identifiants et les données de préférence disparaissent.
 *
 * Confirmation avant suppression, même exigence que le changement de mot de
 * passe (`/auth/settings`, action `password`) : mot de passe actuel requis
 * pour un compte classique ; à défaut de mot de passe (compte Google), un
 * texte exact à saisir — même patron que la purge admin
 * (`/admin/exports/[kind]/purge`).
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getUserPasswordHash } from '$lib/lucia/user';
import { verifyPasswordHash } from '$lib/lucia/password';
import { deleteSessionTokenCookie } from '$lib/lucia/session';
import { anonymizeUser } from '$lib/prisma/user/anonymizeUser';
import { log } from '$lib/server/log';

const DELETE_CONFIRM_TEXT = 'SUPPRIMER';

export const load = (async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/auth/login');
	}
	const passwordHash = await getUserPasswordHash(locals.user.id);
	return { hasPassword: passwordHash !== null };
}) satisfies PageServerLoad;

export const actions: Actions = {
	delete: async (event) => {
		const userId = event.locals.user?.id;
		if (!userId) {
			return fail(401, { message: 'Non connecté' });
		}

		const formData = await event.request.formData();
		const passwordHash = await getUserPasswordHash(userId);

		if (passwordHash !== null) {
			const password = String(formData.get('password') ?? '');
			if (!password || !(await verifyPasswordHash(passwordHash, password))) {
				return fail(400, { message: 'Mot de passe incorrect' });
			}
		} else {
			const confirmText = String(formData.get('confirmText') ?? '');
			if (confirmText !== DELETE_CONFIRM_TEXT) {
				return fail(400, { message: `Merci de saisir exactement « ${DELETE_CONFIRM_TEXT} »` });
			}
		}

		await anonymizeUser(userId);
		log('INFO', 'gdpr', 'Compte anonymisé (demande self-service)', { userId });

		deleteSessionTokenCookie(event);
		redirect(303, '/');
	}
};
