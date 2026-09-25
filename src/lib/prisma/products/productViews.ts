/**
 * Consultation de fiche produit par un compte connecté — sert uniquement à
 * la relance e-mail (`StoreSettings.recentlyViewedReminderEnabled`,
 * `$lib/server/jobs/recentlyViewedReminder.ts`). Sans rapport avec
 * l'historique vitrine « Récemment consultés » (`$lib/store/recentlyViewed.ts`,
 * localStorage, fonctionne aussi pour un visiteur anonyme).
 */
import { prisma } from '$lib/server';

/**
 * Upsert : une revisite met juste à jour `viewedAt`, ne réinitialise jamais
 * `reminderSentAt` une fois posé (même logique que
 * `Order.reviewReminderSentAt` : un seul rappel, jamais réinitialisé).
 */
export async function recordProductView(userId: string, productId: string) {
	await prisma.productView.upsert({
		where: { userId_productId: { userId, productId } },
		update: { viewedAt: new Date() },
		create: { userId, productId }
	});
}
