/**
 * Accès Prisma aux cartes enregistrées (`SavedPaymentMethod`).
 *
 * COMMERCE-PLUGIN : module activable, voir `StoreSettings.savedPaymentsEnabled`
 * (`$lib/server/storeSettings.ts`) — chaque route appelante vérifie déjà le
 * flag avant d'arriver ici. Ce fichier ne fait que la persistance locale
 * (affichage/suppression) : la source de vérité (carte utilisable) reste le
 * `PaymentMethod` Stripe, voir `$lib/server/stripeCustomer.ts`.
 */
import { prisma } from '$lib/server';

export async function listSavedPaymentMethods(userId: string) {
	return prisma.savedPaymentMethod.findMany({
		where: { userId },
		orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
	});
}

export async function createSavedPaymentMethod(data: {
	userId: string;
	stripePaymentMethodId: string;
	brand: string;
	last4: string;
	expMonth: number;
	expYear: number;
	isDefault: boolean;
}) {
	if (data.isDefault) {
		await prisma.savedPaymentMethod.updateMany({
			where: { userId: data.userId },
			data: { isDefault: false }
		});
	}
	return prisma.savedPaymentMethod.create({ data });
}

export async function getSavedPaymentMethodById(userId: string, id: string) {
	return prisma.savedPaymentMethod.findFirst({ where: { id, userId } });
}

export async function deleteSavedPaymentMethod(userId: string, id: string) {
	return prisma.savedPaymentMethod.deleteMany({ where: { id, userId } });
}

export async function setDefaultSavedPaymentMethod(userId: string, id: string) {
	await prisma.savedPaymentMethod.updateMany({
		where: { userId },
		data: { isDefault: false }
	});
	return prisma.savedPaymentMethod.updateMany({
		where: { id, userId },
		data: { isDefault: true }
	});
}
