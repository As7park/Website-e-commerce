/**
 * Parrainage — lien unique par compte (`User.referralCode`, capturé à
 * l'inscription via `?ref=<code>` -> `User.referredById`). La récompense du
 * parrain (une carte cadeau, module Gift Cards) est versée une seule fois par
 * filleul, à sa toute première commande payée — voir
 * `$lib/server/jobs/referral.ts`, appelé depuis le webhook Stripe au même
 * titre que la fidélité (PROMO-PLUGIN). Activable/désactivable via
 * `StoreSettings.referralEnabled`.
 */
import { randomBytes } from 'crypto';
import { prisma } from '$lib/server';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caractères ambigus (0/O, 1/I/L)
const CODE_LENGTH = 8;

/** Remise automatique sur la première commande payée d'un compte parrainé — montant fixe, pas de config admin (coût maîtrisé). */
export const REFERRAL_REFEREE_DISCOUNT_PERCENT = 0.1;

function randomSegment(length: number): string {
	const bytes = randomBytes(length);
	let segment = '';
	for (let i = 0; i < length; i++) {
		segment += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
	}
	return segment;
}

/** Code court, URL-friendly (`/auth/signup?ref=XXXXXXXX`) — retente sur collision improbable. */
export async function generateUniqueReferralCode(): Promise<string> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const code = randomSegment(CODE_LENGTH);
		const existing = await prisma.user.findUnique({ where: { referralCode: code } });
		if (!existing) return code;
	}
	throw new Error('Impossible de générer un code de parrainage unique');
}

export async function getUserByReferralCode(rawCode: string | null | undefined) {
	const code = (rawCode ?? '').trim().toUpperCase();
	if (!code) return null;
	return prisma.user.findUnique({ where: { referralCode: code } });
}

/**
 * Le compte est parrainé et n'a encore aucune commande payée : la remise de
 * bienvenue s'applique sur la commande en cours. Ne dépend d'aucune donnée
 * envoyée par le client — recalculé côté serveur à chaque checkout.
 */
export async function isReferralDiscountEligible(userId: string): Promise<boolean> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { referredById: true }
	});
	if (!user?.referredById) return false;

	const paidOrderCount = await prisma.order.count({ where: { userId, status: 'PAID' } });
	return paidOrderCount === 0;
}

/** Stats affichées sur `/auth/settings/referral` : filleuls inscrits et récompenses déjà gagnées. */
export async function getReferralStats(userId: string) {
	const [referredCount, rewardsCount] = await Promise.all([
		prisma.user.count({ where: { referredById: userId } }),
		prisma.referralReward.count({ where: { referrerId: userId } })
	]);
	return { referredCount, rewardsCount };
}
