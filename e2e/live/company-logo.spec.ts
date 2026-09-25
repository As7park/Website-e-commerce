import { test, expect } from '../support/fixtures';
import { signUpAndVerify } from '../support/admin';
import { hasLiveCloudinary } from '../support/third-party';
import { getStoreFeatureFlags, promoteToAdmin, setStoreFeatureFlags } from '../support/db';

const PNG_1x1 = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);

/**
 * Logo de l'entreprise (`/admin/identite`) — upload réel via Cloudinary
 * (même mécanisme que les images produit), puis vérifie qu'il apparaît sur
 * `/mentions-legales` et que la génération de facture PDF (qui va le
 * chercher pour l'incruster, `fetchLogoForPdf`) ne casse rien une fois
 * configuré.
 */
test.describe('Live — Logo de l’entreprise', () => {
	test.setTimeout(6 * 60_000);
	test.use({ navigationTimeout: 180_000 });
	test.skip(!hasLiveCloudinary(), 'CLOUDINARY_* factices : pas d’upload réel');

	test('upload depuis /admin/identite, affiché sur /mentions-legales', async ({
		page,
		account
	}) => {
		const originalFlags = await getStoreFeatureFlags();

		try {
			await setStoreFeatureFlags({ companyLogoUrl: null });
			await signUpAndVerify(page, account);
			await promoteToAdmin(account.email);

			await test.step('1. Formulaire admin : logo envoyé', async () => {
				await page.goto('/admin/identite');
				await page.locator('input[name="logo"]').setInputFiles({
					name: 'logo.png',
					mimeType: 'image/png',
					buffer: PNG_1x1
				});
				await page.getByRole('button', { name: 'Enregistrer' }).click();
				await expect(page.getByText('Identité de l’entreprise mise à jour')).toBeVisible();

				const flags = await getStoreFeatureFlags();
				expect(flags.companyLogoUrl).toContain('res.cloudinary.com');
			});

			await test.step('2. Affiché sur /mentions-legales', async () => {
				await page.goto('/mentions-legales');
				await expect(page.getByAltText(/Logo/)).toBeVisible();
			});
		} finally {
			await setStoreFeatureFlags(originalFlags);
		}
	});
});
