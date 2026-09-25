import { test, expect } from '../support/fixtures';
import { waitForPath } from '../support/flows';
import { pageOrigin, signUpAndVerify, sveltekitActionHeaders } from '../support/admin';
import { getStoreFeatureFlags, promoteToAdmin, setStoreFeatureFlags } from '../support/db';

/**
 * Identité de l'entreprise (`StoreSettings.company*`) — voir
 * CONFORMITE_ECOMMERCE.md. `null` par défaut ([À COMPLÉTER] sur les
 * mentions légales), vérifie le formulaire admin ET l'affichage réel sur
 * `/mentions-legales` (pas seulement la valeur stockée).
 */
test.describe('Admin — identité de l’entreprise', () => {
	test.setTimeout(4 * 60_000);

	test('modifiée depuis /admin/settings, affichée sur /mentions-legales', async ({
		page,
		account
	}) => {
		const originalFlags = await getStoreFeatureFlags();

		try {
			await setStoreFeatureFlags({
				companyName: null,
				companySiret: null,
				companyAddress: null,
				companyCity: null
			});
			await signUpAndVerify(page, account);
			await promoteToAdmin(account.email);
			const origin = pageOrigin(page);

			await test.step('1. Placeholder tant que non renseigné', async () => {
				await page.goto('/mentions-legales');
				await expect(page.getByText('[À COMPLÉTER]').first()).toBeVisible();
			});

			await test.step('2. Formulaire admin : identité persistée', async () => {
				await page.goto('/admin/settings');
				await waitForPath(page, '/admin/settings');

				const response = await page.request.post('/admin/settings?/updateCompanyIdentity', {
					form: {
						name: 'Bijoux Test SASU',
						legalForm: 'SASU',
						shareCapital: '10 000 €',
						address: '5 Rue de la Paix',
						city: '75002 Paris, France',
						siret: '123 456 789 00012',
						vatNumber: 'FR12345678900',
						publicationDirector: 'Jean Test',
						phone: '+33 1 23 45 67 89',
						email: 'contact@bijoux-test.fr'
					},
					headers: sveltekitActionHeaders(origin)
				});
				expect(response.status()).toBe(200);

				const flags = await getStoreFeatureFlags();
				expect(flags.companyName).toBe('Bijoux Test SASU');
				expect(flags.companySiret).toBe('123 456 789 00012');
			});

			await test.step('3. Affichée sur /mentions-legales, plus de placeholder', async () => {
				await page.goto('/mentions-legales');
				await expect(page.getByText('Bijoux Test SASU')).toBeVisible();
				await expect(page.getByText('123 456 789 00012')).toBeVisible();
				await expect(page.getByText('[À COMPLÉTER]')).toHaveCount(0);
			});
		} finally {
			await setStoreFeatureFlags(originalFlags);
		}
	});
});
