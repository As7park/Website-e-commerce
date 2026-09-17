import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getReferralStats } from '$lib/prisma/referral/referral';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';
import { prisma } from '$lib/server';

/**
 * Mon parrainage — lien unique du compte (`User.referralCode`) et récompenses
 * déjà gagnées. Module activable — 404 si désactivé plutôt qu'une page vide.
 */
export const load = (async ({ locals, url }) => {
	const userId = locals.user?.id;
	if (!userId) {
		redirect(302, '/auth/login');
	}

	const { referralEnabled } = await getStoreFeatureFlags();
	if (!referralEnabled) {
		error(404, 'Page introuvable');
	}

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { referralCode: true }
	});
	if (!user) {
		error(404, 'Page introuvable');
	}

	const stats = await getReferralStats(userId);
	const referralLink = `${url.origin}/auth/signup?ref=${user.referralCode}`;

	return {
		referralCode: user.referralCode,
		referralLink,
		...stats
	};
}) satisfies PageServerLoad;
