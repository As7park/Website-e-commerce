/**
 * Validation JSON pour le checkout. Ouverte, comme `/api/promo/validate` :
 * le code est relu au `?/checkout`, un montant client n'est jamais crédité.
 * `maxApplicable` = reste à payer une fois le code promo éventuel déduit.
 */
import { json } from '@sveltejs/kit';
import { validateGiftCard } from '$lib/prisma/giftCards/giftCards';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';

export const POST = async ({ request }) => {
	try {
		const { giftCardsEnabled } = await getStoreFeatureFlags();
		if (!giftCardsEnabled) {
			return json(
				{
					valid: false,
					amount: 0,
					reason: 'Les cartes cadeaux ne sont pas disponibles',
					code: null
				},
				{ status: 404 }
			);
		}

		const { code, maxApplicable } = await request.json();
		const max = Number(maxApplicable) || 0;

		const result = await validateGiftCard(code, max);

		return json({
			valid: result.valid,
			amount: result.amount,
			reason: result.reason ?? null,
			code: result.giftCard?.code ?? null,
			balance: result.giftCard?.balance ?? null
		});
	} catch (error) {
		console.error('Error validating gift card:', error);
		return json({ valid: false, amount: 0, reason: 'Erreur serveur', code: null }, { status: 500 });
	}
};
