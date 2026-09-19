import { test, expect } from '../support/fixtures';
import { signUpAndVerify } from '../support/admin';
import { signOut } from '../support/flows';
import { makeAccount } from '../support/account';
import { checkoutSessionCompletedPayload, signStripePayload } from '../support/stripe';
import {
	attachOrderAddress,
	createCatalogProduct,
	createUserAddress,
	deleteCatalogProduct,
	getReferralReward,
	getStoreFeatureFlags,
	linkProductToOrder,
	requireUser,
	setStoreFeatureFlags
} from '../support/db';
import { clearMailbox, waitForEmailContaining } from '../support/mailbox';

/**
 * Parrainage : lien unique par utilisateur (`User.referralCode`, capturé à
 * l'inscription via `?ref=<code>` -> `User.referredById`). Le filleul obtient
 * une remise automatique sur sa première commande payée
 * (`isReferralDiscountEligible`, appliquée côté serveur au checkout) ; le
 * parrain reçoit une gift card une fois cette commande payée
 * (`src/lib/server/jobs/referral.ts`, enfilé par le webhook uniquement si
 * `StoreSettings.referralEnabled`, une seule fois par filleul grâce à
 * l'unicité de `ReferralReward.referredId`). Le job tourne en fallback
 * synchrone dans la requête webhook quand QStash n'est pas configuré (cas
 * e2e), donc signer le webhook suffit à déclencher la récompense.
 *
 * `StoreSettings` est une ligne unique partagée par toute la suite : les
 * valeurs d'origine sont restaurées en `finally`.
 */
test.describe('Parrainage', () => {
	test.setTimeout(6 * 60_000);

	test('module désactivé : ni lien capturé ni récompense', async ({ page, account }) => {
		const originalFlags = await getStoreFeatureFlags();
		const referrerAccount = makeAccount();

		try {
			await setStoreFeatureFlags({ referralEnabled: false });

			await signUpAndVerify(page, referrerAccount);
			const referrer = await requireUser(referrerAccount.email);

			await signOut(page);
			await signUpAndVerify(page, account, referrer.referralCode);
			const referred = await requireUser(account.email);

			// Module désactivé : le champ caché `ref` est ignoré côté serveur
			// (`referralEnabled` conditionne la lecture de `formData.get('ref')`
			// dans l'action `signup`), donc pas de lien capturé.
			expect(referred.referredById).toBeNull();

			const created = await createCatalogProduct();
			const { product } = created;
			try {
				const address = await createUserAddress(referred.id);
				const linked = await linkProductToOrder(referred.id, product.id);
				await attachOrderAddress(linked.order.id, address.id);
				const sessionId = `e2e-cs-ref-off-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
				const payload = checkoutSessionCompletedPayload({
					sessionId,
					orderId: linked.order.id,
					email: referred.email
				});
				const response = await page.request.post('/api/webhooks', {
					headers: {
						'content-type': 'application/json',
						'stripe-signature': signStripePayload(payload)
					},
					data: payload
				});
				expect(response.status()).toBe(200);

				expect(await getReferralReward(referred.id)).toBeNull();
			} finally {
				await deleteCatalogProduct(product.id);
			}
		} finally {
			await setStoreFeatureFlags(originalFlags);
		}
	});

	test('filleul remisé, parrain récompensé une seule fois', async ({ page, account }) => {
		const originalFlags = await getStoreFeatureFlags();
		const referrerAccount = makeAccount();

		try {
			await setStoreFeatureFlags({ referralEnabled: true });

			await signUpAndVerify(page, referrerAccount);
			const referrer = await requireUser(referrerAccount.email);

			await signOut(page);
			await signUpAndVerify(page, account, referrer.referralCode);
			const referred = await requireUser(account.email);
			expect(referred.referredById).toBe(referrer.id);

			const created = await createCatalogProduct();
			const { product } = created;
			const address = await createUserAddress(referred.id);

			async function payOrder() {
				const linked = await linkProductToOrder(referred.id, product.id);
				await attachOrderAddress(linked.order.id, address.id);
				const sessionId = `e2e-cs-ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
				const payload = checkoutSessionCompletedPayload({
					sessionId,
					orderId: linked.order.id,
					email: referred.email
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

			try {
				await test.step('1. Première commande payée : récompense créée et e-mail envoyé', async () => {
					await clearMailbox();
					await payOrder();

					await expect(async () => {
						expect(await getReferralReward(referred.id)).not.toBeNull();
					}).toPass();

					const mail = await waitForEmailContaining(referrerAccount.email, 'parrainage');
					expect(mail).toBeTruthy();
				});

				await test.step('2. Deuxième commande payée : pas de deuxième récompense', async () => {
					const reward = await getReferralReward(referred.id);
					await payOrder();
					// Laisse le job (synchrone en fallback e2e) s'exécuter avant de
					// comparer : la récompense doit rester strictement identique.
					await expect(async () => {
						const current = await getReferralReward(referred.id);
						expect(current?.id).toBe(reward?.id);
					}).toPass();
				});
			} finally {
				await deleteCatalogProduct(product.id);
			}
		} finally {
			await setStoreFeatureFlags(originalFlags);
		}
	});
});
