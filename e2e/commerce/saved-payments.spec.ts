import { test, expect } from '../support/fixtures';
import { signUpAndVerify } from '../support/admin';
import {
	createSavedPaymentMethod,
	deleteUser,
	getSavedPaymentMethodsByUserId,
	getStoreFeatureFlags,
	occupyEmail,
	requireUser,
	setStoreFeatureFlags
} from '../support/db';

/**
 * Moyens de paiement enregistrés : module activable
 * (`StoreSettings.savedPaymentsEnabled`, 404 partout si désactivé), liste,
 * carte par défaut, suppression.
 *
 * L'ajout de carte (`?/attach`) passe par un `SetupIntent` Stripe réel : non
 * rejouable en e2e sans Stripe Elements. Les cartes sont donc insérées
 * directement en base (`createSavedPaymentMethod`), comme si `attach` avait
 * déjà réussi — seules les routes de lecture/suppression/défaut sont
 * couvertes ici.
 *
 * `StoreSettings` est une ligne unique partagée par toute la suite : les
 * valeurs d'origine sont restaurées en `finally`.
 */
test.describe('Moyens de paiement enregistrés', () => {
	test.setTimeout(6 * 60_000);

	test('module désactivé ferme la route et le point d’entrée SetupIntent', async ({
		page,
		account
	}) => {
		const originalFlags = await getStoreFeatureFlags();
		try {
			await setStoreFeatureFlags({ savedPaymentsEnabled: false });
			await signUpAndVerify(page, account);

			const response = await page.goto('/auth/settings/saved-payments');
			expect(response?.status()).toBe(404);

			const origin = new URL(page.url()).origin;
			const setupResponse = await page.request.post('/auth/settings/saved-payments/setup-intent', {
				headers: { Origin: origin }
			});
			expect(setupResponse.status()).toBe(404);
		} finally {
			await setStoreFeatureFlags(originalFlags);
		}
	});

	test('liste, carte par défaut, suppression', async ({ page, account }) => {
		const originalFlags = await getStoreFeatureFlags();

		try {
			await setStoreFeatureFlags({ savedPaymentsEnabled: true });
			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);

			const first = await createSavedPaymentMethod(user.id, {
				brand: 'visa',
				last4: '4242',
				isDefault: true
			});
			const second = await createSavedPaymentMethod(user.id, {
				brand: 'mastercard',
				last4: '5555',
				isDefault: false
			});

			await test.step('1. Les deux cartes sont listées, la première par défaut', async () => {
				await page.goto('/auth/settings/saved-payments');
				await expect(page.getByText('visa •••• 4242')).toBeVisible();
				await expect(page.getByText('mastercard •••• 5555')).toBeVisible();
				await expect(page.getByText('(par défaut)')).toBeVisible();
			});

			await test.step('2. Changement de carte par défaut', async () => {
				await page
					.locator('form[action="?/setDefault"]')
					.filter({ has: page.locator(`input[value="${second.id}"]`) })
					.getByRole('button', { name: 'Définir par défaut' })
					.click();

				await expect(async () => {
					const methods = await getSavedPaymentMethodsByUserId(user.id);
					expect(methods.find((m) => m.id === second.id)?.isDefault).toBe(true);
					expect(methods.find((m) => m.id === first.id)?.isDefault).toBe(false);
				}).toPass();
			});

			await test.step('3. Suppression', async () => {
				await page
					.locator('form[action="?/delete"]')
					.filter({ has: page.locator(`input[value="${first.id}"]`) })
					.getByRole('button', { name: 'Supprimer' })
					.click();

				await expect(page.getByText('visa •••• 4242')).toHaveCount(0);
				await expect(async () => {
					const methods = await getSavedPaymentMethodsByUserId(user.id);
					expect(methods.map((m) => m.id)).not.toContain(first.id);
				}).toPass();
			});
		} finally {
			await setStoreFeatureFlags(originalFlags);
		}
	});

	test('IDOR : un compte ne peut pas supprimer la carte d’un autre', async ({ page, account }) => {
		const originalFlags = await getStoreFeatureFlags();
		const otherEmail = `e2e-saved-payments-other-${Date.now()}@example.test`;
		await occupyEmail(otherEmail);
		const other = await requireUser(otherEmail);
		const otherCard = await createSavedPaymentMethod(other.id);

		try {
			await setStoreFeatureFlags({ savedPaymentsEnabled: true });
			await signUpAndVerify(page, account);

			const origin = new URL(page.url()).origin;
			await page.request.post('/auth/settings/saved-payments?/delete', {
				form: { id: otherCard.id },
				headers: { Origin: origin }
			});

			const methods = await getSavedPaymentMethodsByUserId(other.id);
			expect(methods.map((m) => m.id)).toContain(otherCard.id);
		} finally {
			await setStoreFeatureFlags(originalFlags);
			await deleteUser(otherEmail);
		}
	});
});
