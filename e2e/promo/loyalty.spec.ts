import { test, expect } from '../support/fixtures';
import { signUpAndVerify } from '../support/admin';
import { checkoutSessionCompletedPayload, signStripePayload } from '../support/stripe';
import {
	attachOrderAddress,
	createCatalogProduct,
	createPromoCode,
	createUserAddress,
	deleteCatalogProduct,
	deletePromoCode,
	getLoyaltyAward,
	getStoreFeatureFlags,
	linkProductToOrder,
	requireUser,
	setStoreFeatureFlags
} from '../support/db';
import { clearMailbox, waitForEmailContaining } from '../support/mailbox';

/**
 * Fidélité : pas de système séparé — un `PromoCode` actif avec un
 * `loyaltyThreshold` est comparé au nombre de commandes payées du compte
 * après chaque webhook `checkout.session.completed`
 * (`src/lib/server/jobs/loyalty.ts`, enfilé par le webhook uniquement si
 * `StoreSettings.loyaltyEnabled`). Le job tourne en fallback synchrone dans
 * la requête webhook quand QStash n'est pas configuré (cas e2e), donc
 * signer le webhook suffit à déclencher la vérification — pas besoin d'appel
 * de job séparé.
 *
 * `StoreSettings` est une ligne unique partagée par toute la suite : les
 * valeurs d'origine sont restaurées en `finally`.
 */
test.describe('Fidélité', () => {
	test.setTimeout(6 * 60_000);

	test('récompense accordée au seuil, jamais deux fois', async ({ page, account }) => {
		const originalFlags = await getStoreFeatureFlags();
		const created = await createCatalogProduct();
		const { product } = created;
		const promoCode = `E2ELOY${Date.now().toString(36).toUpperCase()}`;
		const promo = await createPromoCode(promoCode, { loyaltyThreshold: 2 });

		try {
			await setStoreFeatureFlags({ loyaltyEnabled: true });
			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);
			const address = await createUserAddress(user.id);

			async function payOrder() {
				const linked = await linkProductToOrder(user.id, product.id);
				await attachOrderAddress(linked.order.id, address.id);
				const sessionId = `e2e-cs-loyalty-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
				const payload = checkoutSessionCompletedPayload({
					sessionId,
					orderId: linked.order.id,
					email: account.email
				});
				const response = await page.request.post('/api/webhooks', {
					headers: {
						'content-type': 'application/json',
						'stripe-signature': signStripePayload(payload)
					},
					data: payload
				});
				expect(response.status()).toBe(200);
			}

			await test.step('1. Premi\u00e8re commande pay\u00e9e : pas encore de r\u00e9compense', async () => {
				await payOrder();
				expect(await getLoyaltyAward(user.id, promo.id)).toBeNull();
			});

			await test.step('2. Seuil atteint : récompense créée et e-mail envoyé', async () => {
				await clearMailbox();
				await payOrder();

				await expect(async () => {
					expect(await getLoyaltyAward(user.id, promo.id)).not.toBeNull();
				}).toPass();

				const mail = await waitForEmailContaining(account.email, promoCode);
				expect(mail.raw).toContain(promoCode);
			});

			await test.step('3. Une commande de plus ne double pas la récompense', async () => {
				await payOrder();
				const awards = await getLoyaltyAward(user.id, promo.id);
				expect(awards?.orderCountAtAward).toBe(2);
			});
		} finally {
			await setStoreFeatureFlags(originalFlags);
			await deletePromoCode(promo.id);
			await deleteCatalogProduct(product.id);
		}
	});
});
