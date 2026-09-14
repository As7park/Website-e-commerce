/**
 * Accès Prisma à la liste d'envies.
 *
 * PRODUCT-PLUGIN : module activable, voir `StoreSettings.wishlistEnabled`
 * (`$lib/server/storeSettings.ts`) — chaque route appelante vérifie déjà le
 * flag avant d'arriver ici ; ce fichier ne le revérifie pas lui-même.
 */
import { prisma } from '$lib/server';

export async function isInWishlist(userId: string, productId: string): Promise<boolean> {
	const item = await prisma.wishlistItem.findUnique({
		where: { userId_productId: { userId, productId } },
		select: { id: true }
	});
	return item !== null;
}

/** Ajoute ou retire le produit de la liste, et renvoie le nouvel état. */
export async function toggleWishlistItem(userId: string, productId: string): Promise<boolean> {
	const existing = await prisma.wishlistItem.findUnique({
		where: { userId_productId: { userId, productId } },
		select: { id: true }
	});

	if (existing) {
		await prisma.wishlistItem.delete({ where: { id: existing.id } });
		return false;
	}

	await prisma.wishlistItem.create({ data: { userId, productId } });
	return true;
}

export async function listWishlistForUser(userId: string) {
	const items = await prisma.wishlistItem.findMany({
		where: { userId },
		include: { product: true },
		orderBy: { createdAt: 'desc' }
	});
	return items.map((item) => item.product);
}
