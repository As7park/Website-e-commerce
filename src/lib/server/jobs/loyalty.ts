/**
 * Vérification de la fidélité, sortie du chemin synchrone du webhook Stripe
 * (`src/routes/api/webhooks/+server.ts`), au même titre que la facture et
 * Sendcloud (`invoice-email.ts` / `post-payment.ts`).
 *
 * PROMO-PLUGIN : la configuration (seuil, code offert) vit sur `PromoCode`
 * (`loyaltyThreshold`), gérée depuis `/admin/promo` — ce module ne fait que
 * comparer le nombre de commandes payées du compte à ces seuils et notifier
 * par e-mail. `StoreSettings.loyaltyEnabled` est vérifié par l'appelant
 * (webhook) avant d'enfiler ce job, pas ici.
 */
import { prisma } from '$lib/server';
import { withLock } from '$lib/server/lock';
import { sendMail } from '$lib/server/smtp-mail';
import { log } from '$lib/server/log';
import { withDuration } from '$lib/server/metrics';

/**
 * Recherche, pour la commande donnée, si son compte vient d'atteindre un
 * seuil de fidélité actif — et si oui, crée `LoyaltyAward` (idempotent via
 * la contrainte unique `[userId, promoCodeId]`) puis envoie l'e-mail.
 *
 * Un compte peut recevoir plusieurs récompenses (une par code à seuil
 * distinct), jamais deux fois la même : `already` court-circuite avant
 * l'envoi si `LoyaltyAward` existe déjà pour ce couple.
 */
export async function runLoyaltyCheckJob(orderId: string): Promise<void> {
	await withDuration('job.loyalty-check', () =>
		withLock(`loyalty-check:${orderId}`, 30, async () => {
			const order = await prisma.order.findUnique({
				where: { id: orderId },
				select: { id: true, userId: true, status: true }
			});
			if (!order) {
				log('WARN', 'loyalty-check', `Commande introuvable: ${orderId}`);
				return;
			}
			if (order.status !== 'PAID') {
				log('WARN', 'loyalty-check', `Commande non payée, vérification ignorée: ${orderId}`);
				return;
			}

			const user = await prisma.user.findUnique({
				where: { id: order.userId },
				select: { id: true, email: true, username: true }
			});
			if (!user) {
				log('WARN', 'loyalty-check', `Utilisateur introuvable pour la commande: ${orderId}`);
				return;
			}

			const paidOrderCount = await prisma.order.count({
				where: { userId: user.id, status: 'PAID' }
			});

			const eligiblePromos = await prisma.promoCode.findMany({
				where: {
					active: true,
					loyaltyThreshold: { not: null, lte: paidOrderCount }
				}
			});

			for (const promo of eligiblePromos) {
				const already = await prisma.loyaltyAward.findUnique({
					where: { userId_promoCodeId: { userId: user.id, promoCodeId: promo.id } }
				});
				if (already) continue;

				await prisma.loyaltyAward.create({
					data: { userId: user.id, promoCodeId: promo.id, orderCountAtAward: paidOrderCount }
				});

				await sendMail({
					to: user.email,
					subject: 'Un code fidélité vous attend 🎁',
					text: `Merci pour votre fidélité ! Vous avez atteint ${paidOrderCount} commande(s) payée(s) et recevez le code ${promo.code}, à utiliser lors de votre prochaine commande.`,
					html: `<p>Merci pour votre fidélité !</p><p>Vous avez atteint <strong>${paidOrderCount}</strong> commande(s) payée(s) et recevez le code <strong>${promo.code}</strong>, à utiliser lors de votre prochaine commande.</p>`
				});

				log('INFO', 'loyalty-check', 'Récompense fidélité accordée', {
					userId: user.id,
					promoCodeId: promo.id,
					orderCount: paidOrderCount
				});
			}
		})
	);
}
