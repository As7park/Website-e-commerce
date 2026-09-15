import { test, expect } from '../support/fixtures';
import { waitForPath } from '../support/flows';
import { signUpAndVerify } from '../support/admin';
import { postValidateGiftCard } from '../support/giftCards';
import {
	createCatalogProduct,
	createGiftCard,
	createPromoCode,
	deleteCatalogProduct,
	deleteGiftCard,
	deletePromoCode,
	getStoreFeatureFlags,
	setStoreFeatureFlags
} from '../support/db';

/**
 * Cartes cadeaux (solde décroissant) : contrat `validateGiftCard` via l'API,
 * puis application UI au checkout, seule ou cumulée avec un code promo.
 * Stripe n'est pas appelé : `decrementGiftCardBalance` reste hors de ce spec
 * (comme `incrementUsage` pour les codes promo, cf. `promo/validate.spec.ts`).
 */
test.describe('Cartes cadeaux — validation', () => {
	test.setTimeout(6 * 60_000);

	test('API : acceptée, inconnue, inactive, expirée, épuisée, plafonnée', async ({ page }) => {
		const stamp = Date.now().toString(36).toUpperCase();
		const ok = await createGiftCard(`E2EOK${stamp}`, { initialValue: 30 });
		const inactive = await createGiftCard(`E2EIN${stamp}`, { active: false });
		const expired = await createGiftCard(`E2EEX${stamp}`, {
			expiresAt: new Date(Date.now() - 60_000)
		});
		const exhausted = await createGiftCard(`E2EEP${stamp}`, { initialValue: 20, balance: 0 });
		const capped = await createGiftCard(`E2ECP${stamp}`, { initialValue: 100 });

		const previousFlags = await getStoreFeatureFlags();
		try {
			await setStoreFeatureFlags({ giftCardsEnabled: true });
			await page.goto('/');

			await test.step('1. Carte valide, montant plafonné par le solde', async () => {
				const { status, json } = await postValidateGiftCard(page, {
					code: ok.code,
					maxApplicable: 100
				});
				expect(status).toBe(200);
				expect(json.valid).toBe(true);
				expect(json.amount).toBeCloseTo(30, 2);
				expect(json.code).toBe(ok.code);
			});

			await test.step('2. Code inconnu / inactif / expiré / solde épuisé', async () => {
				const unknown = await postValidateGiftCard(page, {
					code: 'INCONNUE-E2E',
					maxApplicable: 100
				});
				expect(unknown.json.valid).toBe(false);

				const off = await postValidateGiftCard(page, { code: inactive.code, maxApplicable: 100 });
				expect(off.json.valid).toBe(false);
				expect(String(off.json.reason)).toMatch(/inactive/i);

				const past = await postValidateGiftCard(page, { code: expired.code, maxApplicable: 100 });
				expect(past.json.valid).toBe(false);
				expect(String(past.json.reason)).toMatch(/expiré/i);

				const empty = await postValidateGiftCard(page, {
					code: exhausted.code,
					maxApplicable: 100
				});
				expect(empty.json.valid).toBe(false);
				expect(String(empty.json.reason)).toMatch(/épuisé/i);
			});

			await test.step('3. Montant plafonné par le reste à payer (pas seulement le solde)', async () => {
				const { json } = await postValidateGiftCard(page, {
					code: capped.code,
					maxApplicable: 12.5
				});
				expect(json.valid).toBe(true);
				expect(json.amount).toBeCloseTo(12.5, 2);
			});

			await test.step('4. Désactivée globalement : refusée même avec un code valide', async () => {
				await setStoreFeatureFlags({ giftCardsEnabled: false });
				const { status, json } = await postValidateGiftCard(page, {
					code: ok.code,
					maxApplicable: 100
				});
				expect(status).toBe(404);
				expect(json.valid).toBe(false);
			});
		} finally {
			await setStoreFeatureFlags(previousFlags);
			await deleteGiftCard(ok.id);
			await deleteGiftCard(inactive.id);
			await deleteGiftCard(expired.id);
			await deleteGiftCard(exhausted.id);
			await deleteGiftCard(capped.id);
		}
	});

	test('checkout : carte cadeau appliquée seule puis cumulée à un code promo', async ({
		page,
		account
	}) => {
		const stamp = Date.now().toString(36).toUpperCase();
		const giftCard = await createGiftCard(`E2ECK${stamp}`, { initialValue: 5 });
		const promo = await createPromoCode(`E2ECKP${stamp}`, { type: 'FIXED', value: 3 });
		const created = await createCatalogProduct();
		const previousFlags = await getStoreFeatureFlags();

		try {
			await setStoreFeatureFlags({ giftCardsEnabled: true });

			await page.goto('/');
			await expect(page.locator('body')).toBeVisible();

			await signUpAndVerify(page, account);
			await page.goto(`/products/${created.product.slug}`);
			await expect(page.getByRole('button', { name: 'Ajouter au panier' })).toBeVisible();
			const save = page.waitForResponse(
				(response) =>
					response.url().includes('/api/save-cart') && response.request().method() === 'POST'
			);
			await page.getByRole('button', { name: 'Ajouter au panier' }).click();
			await save;

			await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
			await waitForPath(page, '/checkout');
			await expect(page.getByRole('heading', { name: 'Carte cadeau' })).toBeVisible({
				timeout: 60_000
			});

			await test.step('5. Carte cadeau seule', async () => {
				const giftCardField = page.getByPlaceholder('GIFT-XXXX-XXXX-XXXX');
				await giftCardField.fill(giftCard.code);
				const validate = page.waitForResponse(
					(response) =>
						response.url().includes('/api/gift-cards/validate') &&
						response.request().method() === 'POST'
				);
				// Le bouton « Appliquer » est un frère direct du champ dans le
				// `<div class="flex gap-2">` de `GiftCardInput.svelte` — remonter
				// d'un niveau le scope correctement (deux boutons « Appliquer »
				// coexistent sur la page : celui du code promo et celui-ci).
				await giftCardField.locator('..').getByRole('button', { name: 'Appliquer' }).click();
				await validate;
				await expect(page.getByText(giftCard.code, { exact: true })).toBeVisible();
			});

			await test.step('6. Ajout d’un code promo : le plafond de la carte est revalidé', async () => {
				const promoField = page.getByPlaceholder('Entrez votre code');
				await promoField.fill(promo.code);
				const validate = page.waitForResponse(
					(response) =>
						response.url().includes('/api/promo/validate') && response.request().method() === 'POST'
				);
				await promoField.locator('..').getByRole('button', { name: 'Appliquer' }).click();
				await validate;
				await expect(page.getByText(promo.code, { exact: true })).toBeVisible();
				// La carte cadeau a été retirée côté client (plafond changé) : à
				// réappliquer, comportement documenté dans checkout/+page.svelte.
				await expect(page.getByPlaceholder('GIFT-XXXX-XXXX-XXXX')).toBeVisible();
			});
		} finally {
			await setStoreFeatureFlags(previousFlags);
			await deleteGiftCard(giftCard.id);
			await deletePromoCode(promo.id);
			await deleteCatalogProduct(created.product.id);
		}
	});
});
