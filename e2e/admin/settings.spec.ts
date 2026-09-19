import { test, expect } from '../support/fixtures';
import { waitForPath } from '../support/flows';
import { pageOrigin, signUpAndVerify } from '../support/admin';
import { getStoreFeatureFlags, promoteToAdmin, setStoreFeatureFlags } from '../support/db';

/**
 * Modules e-commerce optionnels (`/admin/settings`) : un module désactivé
 * ferme ses routes publiques, pas seulement son UI — voir `wishlist.spec.ts`
 * pour la fermeture 404 elle-même. Ici : la page bascule bien les 5
 * interrupteurs et un CLIENT ne peut pas les modifier.
 *
 * `StoreSettings` est une ligne unique partagée par toute la suite : les
 * valeurs d'origine sont restaurées en `finally`.
 */
test.describe('Administration — modules e-commerce', () => {
	test.setTimeout(6 * 60_000);

	test('bascule des modules depuis /admin/settings', async ({ page, account }) => {
		const originalFlags = await getStoreFeatureFlags();

		try {
			await setStoreFeatureFlags({
				wishlistEnabled: false,
				crossSellEnabled: false,
				returnsEnabled: false,
				savedPaymentsEnabled: false,
				loyaltyEnabled: false
			});

			await signUpAndVerify(page, account);
			await promoteToAdmin(account.email);

			await test.step('1. Les modules apparaissent désactivés', async () => {
				await page.goto('/admin/settings');
				await waitForPath(page, '/admin/settings');
				await expect(page.getByRole('heading', { name: 'Modules e-commerce' })).toBeVisible();
				for (const id of [
					'wishlistEnabled',
					'crossSellEnabled',
					'returnsEnabled',
					'savedPaymentsEnabled',
					'loyaltyEnabled'
				]) {
					await expect(page.locator(`#${id}`)).toHaveAttribute('data-state', 'unchecked');
				}
			});

			await test.step('2. Activer la liste d’envies — enregistré immédiatement (pas de bouton)', async () => {
				await page.locator('#wishlistEnabled').click();
				await expect(page.getByText('Modules mis à jour')).toBeVisible();

				const flags = await getStoreFeatureFlags();
				expect(flags.wishlistEnabled).toBe(true);
				expect(flags.crossSellEnabled).toBe(false);
			});

			await test.step('3. Rechargée, la page reflète l’état enregistré', async () => {
				await page.reload();
				await expect(page.locator('#wishlistEnabled')).toHaveAttribute('data-state', 'checked');
				await expect(page.locator('#crossSellEnabled')).toHaveAttribute('data-state', 'unchecked');
			});
		} finally {
			await setStoreFeatureFlags(originalFlags);
		}
	});

	test('un CLIENT ne peut pas modifier les modules', async ({ page, account }) => {
		const originalFlags = await getStoreFeatureFlags();

		try {
			await signUpAndVerify(page, account);
			const origin = pageOrigin(page);
			await page.request.post('/admin/settings', {
				form: { wishlistEnabled: 'on' },
				headers: { Origin: origin }
			});

			const flags = await getStoreFeatureFlags();
			expect(flags.wishlistEnabled).toBe(originalFlags.wishlistEnabled);
		} finally {
			await setStoreFeatureFlags(originalFlags);
		}
	});
});
