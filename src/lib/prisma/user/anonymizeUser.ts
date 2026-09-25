/**
 * Droit à l'effacement (RGPD art. 17) — anonymise un compte au lieu de le
 * supprimer physiquement. `Order.user` est `onDelete: Restrict` : un
 * `prisma.user.delete()` est de toute façon impossible tant que le compte a
 * des commandes, sans les supprimer d'abord — ce que faisait l'ancienne
 * implémentation de `deleteUser` (`$lib/prisma/user/user.ts`), détruisant au
 * passage l'historique comptable que `Order.user` est justement censé
 * protéger (obligation de conservation 10 ans, Code de commerce L123-22).
 *
 * Ici, la ligne `User` n'est jamais supprimée : ses champs identifiants sont
 * vidés/remplacés, puis seules les données de pure préférence/navigation
 * (sans aucune valeur de conservation légale) sont supprimées. `Order`,
 * `Transaction`, `Review`, `ReturnRequest`, `ProductQuestion`,
 * `LoyaltyAward`, `ReferralReward` ne sont jamais touchés — ils restent
 * rattachés au compte, désormais anonyme.
 *
 * Utilisée à la fois par la suppression admin (`/admin/users?/deleteUser`)
 * et par le flux self-service (`/auth/settings/donnees`) — un seul chemin
 * correct, pas deux implémentations qui pourraient diverger.
 */
import { prisma } from '$lib/server';
import { stripe } from '$lib/server/stripe';
import { invalidateUserSessions } from '$lib/lucia/session';

export async function anonymizeUser(userId: string): Promise<void> {
	const savedPaymentMethods = await prisma.savedPaymentMethod.findMany({
		where: { userId },
		select: { stripePaymentMethodId: true }
	});

	// Détachement Stripe best-effort, comme `saved-payments` `?/delete` :
	// une carte déjà détachée (webhook, double appel) ne doit jamais bloquer
	// l'anonymisation du compte.
	for (const method of savedPaymentMethods) {
		try {
			await stripe.paymentMethods.detach(method.stripePaymentMethodId);
		} catch (err) {
			console.error('Erreur détachement PaymentMethod Stripe (anonymisation):', err);
		}
	}

	await prisma.$transaction([
		prisma.user.update({
			where: { id: userId },
			data: {
				email: `deleted-${userId}@erased.local`,
				username: null,
				name: null,
				picture: null,
				passwordHash: null,
				recoveryCode: null,
				totpKey: null,
				googleId: null,
				stripeCustomerId: null,
				isMfaEnabled: false,
				emailVerified: false,
				marketingEmailsOptIn: false
			}
		}),
		prisma.savedPaymentMethod.deleteMany({ where: { userId } }),
		prisma.address.deleteMany({ where: { userId } }),
		prisma.wishlistItem.deleteMany({ where: { userId } }),
		prisma.stockAlert.deleteMany({ where: { userId } }),
		prisma.productView.deleteMany({ where: { userId } }),
		prisma.emailVerificationRequest.deleteMany({ where: { userId } }),
		prisma.passwordResetSession.deleteMany({ where: { userId } })
	]);

	// Même mécanisme que la déconnexion/le changement de mot de passe — pas
	// de logique de révocation dupliquée ici.
	await invalidateUserSessions(userId);
}
