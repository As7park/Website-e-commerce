/**
 * Tunnel de paiement.
 *
 * COMMERCE-PLUGIN : login obligatoire, la commande doit appartenir au visiteur,
 * les frais de port Sendcloud (0–200 €) sont acceptés pour créer la session
 * Stripe. PROMO-PLUGIN : `validatePromo` / `incrementUsage` restent ici
 * pour que le checkout compile ; ce n'est pas le périmètre du module.
 */
import { zod } from 'sveltekit-superforms/adapters';
import { superValidate } from 'sveltekit-superforms';

import { error, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { getOrderById } from '$lib/prisma/order/prendingOrder';
import { getUserAddresses } from '$lib/prisma/addresses/addresses';
import { OrderSchema } from '$lib/schema/order/order';
import { validatePromo, incrementUsage } from '$lib/prisma/promo/promo';
import { validateGiftCard, decrementGiftCardBalance } from '$lib/prisma/giftCards/giftCards';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';
import { prisma } from '$lib/server';
import {
	assertOrderOwnedBy,
	createCheckoutSession,
	resolveTrustedShippingCost,
	TVA_RATE
} from '$lib/commerce/checkout';
import { CartForbiddenError, InvalidShippingError } from '$lib/commerce/errors';

export const load = (async ({ locals }) => {
	// AUTH-PLUGIN ▼ le paiement est réservé aux comptes : la commande et les
	// adresses sont rattachées à `User`. Rendre le tunnel anonyme suppose de
	// revoir le modèle de données (voir docs/auth/retrait.md).
	const userId = locals.user?.id;
	if (!userId) {
		throw redirect(302, '/auth/login');
	}
	// AUTH-PLUGIN ▲
	const IOrderSchema = await superValidate(zod(OrderSchema));
	const addresses = await getUserAddresses(userId);
	const { giftCardsEnabled } = await getStoreFeatureFlags();

	return {
		addresses,
		IOrderSchema,
		giftCardsEnabled
	};
}) satisfies PageServerLoad;

export const actions: Actions = {
	checkout: async ({ request, locals }) => {
		const userId = locals.user?.id;
		if (!userId) {
			throw redirect(302, '/auth/login');
		}

		const formData = await request.formData();
		const form = await superValidate(formData, zod(OrderSchema));

		const {
			orderId,
			shippingAddressId,
			billingAddressId,
			shippingOption,
			shippingCost,
			promoCode,
			giftCardCode,
			servicePointId,
			servicePointPostNumber,
			servicePointLatitude,
			servicePointLongitude,
			servicePointType,
			servicePointExtraRefCab,
			servicePointExtraShopRef
		} = form.data;

		if (!orderId || !shippingAddressId || !billingAddressId) {
			error(400, 'Veuillez sélectionner une adresse.');
		}

		try {
			await assertOrderOwnedBy(orderId, userId);
		} catch (err) {
			if (err instanceof CartForbiddenError) {
				error(403, err.message);
			}
			throw err;
		}

		const order = await getOrderById(orderId);
		if (!order) {
			error(404, 'Commande introuvable');
		}

		const hasCustomItems = order.items.some((item) => item.custom.length > 0);

		let trustedShippingCost: number;
		try {
			trustedShippingCost = resolveTrustedShippingCost({
				hasCustomItems,
				shippingOption,
				shippingCost
			});
		} catch (err) {
			if (err instanceof InvalidShippingError) {
				error(400, err.message);
			}
			throw err;
		}

		// PROMO-PLUGIN ▼ hors périmètre commerce ; conservé pour que le tunnel compile.
		const productTotalTTC = parseFloat(
			order.items
				.reduce((sum, item) => sum + item.product.price * (1 + TVA_RATE) * item.quantity, 0)
				.toFixed(2)
		);
		const promoResult = await validatePromo(promoCode, productTotalTTC);
		const promoDiscount = promoResult.valid ? promoResult.discountAmount : 0;
		const appliedPromoCode = promoResult.valid ? (promoResult.promo?.code ?? null) : null;
		// PROMO-PLUGIN ▲

		// Carte cadeau : plafonnée par ce qu'il reste à payer une fois la remise
		// promo ci-dessus déduite. Comme pour `validatePromo`, seul ce calcul
		// serveur fait foi — jamais un montant envoyé par le client.
		const { giftCardsEnabled } = await getStoreFeatureFlags();
		const giftCardResult = giftCardsEnabled
			? await validateGiftCard(giftCardCode, Math.max(0, productTotalTTC - promoDiscount))
			: { valid: false, amount: 0, giftCard: null };
		const appliedGiftCardAmount = giftCardResult.valid ? giftCardResult.amount : 0;
		const appliedGiftCardCode = giftCardResult.valid
			? (giftCardResult.giftCard?.code ?? null)
			: null;

		const appliedDiscount = parseFloat((promoDiscount + appliedGiftCardAmount).toFixed(2));

		// COMMERCE-PLUGIN : réutilise le client Stripe existant (`savedPaymentsEnabled`)
		// s'il en existe déjà un pour ce compte — n'en crée jamais un ici.
		const currentUser = await prisma.user.findUnique({
			where: { id: userId },
			select: { stripeCustomerId: true }
		});

		const session = await createCheckoutSession({
			order,
			userId,
			origin: request.headers.get('origin') ?? '',
			shippingAddressId,
			billingAddressId,
			shippingOption: hasCustomItems ? 'no_shipping' : shippingOption || 'no_shipping',
			trustedShippingCost,
			hasCustomItems,
			promoCode: appliedPromoCode,
			discountAmount: appliedDiscount,
			giftCardCode: appliedGiftCardCode,
			giftCardAmount: appliedGiftCardAmount,
			stripeCustomerId: currentUser?.stripeCustomerId,
			servicePoint: {
				id: servicePointId,
				postNumber: servicePointPostNumber,
				latitude: servicePointLatitude,
				longitude: servicePointLongitude,
				type: servicePointType,
				extraRefCab: servicePointExtraRefCab,
				extraShopRef: servicePointExtraShopRef
			}
		});

		if (promoResult.valid && promoResult.promo) {
			try {
				await incrementUsage(promoResult.promo.id);
			} catch (err) {
				console.error('Erreur incrementUsage code promo:', err);
			}
		}

		if (giftCardResult.valid && giftCardResult.giftCard && appliedGiftCardAmount > 0) {
			try {
				await decrementGiftCardBalance(giftCardResult.giftCard.id, appliedGiftCardAmount);
			} catch (err) {
				console.error('Erreur decrementGiftCardBalance:', err);
			}
		}

		throw redirect(303, session.url || '/');
	}
};
