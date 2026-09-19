/**
 * Accès Prisma à la file d'attente "Me prévenir" (`StockAlert`), distincte du
 * module Questions produit mais construite sur le même patron : liée à un
 * compte, jamais un simple e-mail anonyme. `notifiedAt` distingue une
 * inscription encore en attente (`null`) d'une déjà notifiée. Activable/
 * désactivable via `StoreSettings.stockAlertsEnabled` — chaque route
 * appelante vérifie déjà le flag avant d'arriver ici ; ce fichier ne le
 * revérifie pas lui-même (même convention que `wishlist.ts`).
 */
import { prisma } from '$lib/server';

/** Le compte a-t-il une inscription encore en attente sur ce produit ? */
export async function isPendingStockAlert(userId: string, productId: string): Promise<boolean> {
	const item = await prisma.stockAlert.findUnique({
		where: { productId_userId: { productId, userId } },
		select: { notifiedAt: true }
	});
	return item !== null && item.notifiedAt === null;
}

/**
 * Bascule l'inscription et renvoie le nouvel état (même sémantique que
 * `toggleWishlistItem`) : déjà en attente → désinscription (suppression) ;
 * déjà notifiée (rupture précédente) ou absente → (ré)inscription.
 */
export async function toggleStockAlertSubscription(
	userId: string,
	productId: string
): Promise<boolean> {
	const existing = await prisma.stockAlert.findUnique({
		where: { productId_userId: { productId, userId } }
	});

	if (existing && existing.notifiedAt === null) {
		await prisma.stockAlert.delete({ where: { id: existing.id } });
		return false;
	}

	if (existing) {
		await prisma.stockAlert.update({ where: { id: existing.id }, data: { notifiedAt: null } });
		return true;
	}

	await prisma.stockAlert.create({ data: { userId, productId } });
	return true;
}

/** Inscriptions encore en attente pour un produit — lues par le job de réassort. */
export async function listPendingStockAlerts(productId: string) {
	return prisma.stockAlert.findMany({
		where: { productId, notifiedAt: null },
		select: { id: true, user: { select: { email: true } } }
	});
}

export async function markStockAlertsNotified(ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	await prisma.stockAlert.updateMany({
		where: { id: { in: ids } },
		data: { notifiedAt: new Date() }
	});
}
