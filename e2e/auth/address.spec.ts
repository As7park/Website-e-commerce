import { test, expect } from '../support/fixtures';
import {
	clickThroughOverlay,
	fillStable,
	requestSubmitForm,
	visibleNamedInput,
	waitForPath
} from '../support/flows';
import { pageOrigin, signUpAndVerify, sveltekitActionHeaders } from '../support/admin';
import {
	E2E_ADDRESS_QUERY,
	E2E_ADDRESS_SUGGESTIONS,
	LIVE_ADDRESS_QUERY
} from '../../src/lib/addresses/address-search-e2e';
import { hasLiveAddressSearch } from '../support/third-party';
import {
	createUserAddress,
	deleteUser,
	findAddressById,
	findAddressesByUserId,
	occupyEmail,
	requireUser
} from '../support/db';

/**
 * Carnet d'adresses : Base Adresse Nationale (BAN) réelle si le mode n'est pas
 * factice, sinon fixture.
 */
test.describe('Auth — adresses', () => {
	test.setTimeout(6 * 60_000);

	test('géocodage, création, IDOR, suppression', async ({ page, account }) => {
		const live = hasLiveAddressSearch();
		const query = live ? LIVE_ADDRESS_QUERY : E2E_ADDRESS_QUERY;

		await test.step('1. Anonyme GET /auth/settings/address', async () => {
			await page.goto('/auth/settings/address', { waitUntil: 'domcontentloaded' });
			await waitForPath(page, '/auth/login');
		});

		await test.step("2. La recherche d'adresse refuse une requête vide", async () => {
			const missing = await page.request.get('/api/address-search');
			expect(missing.status()).toBe(400);
		});

		await signUpAndVerify(page, account);
		const user = await requireUser(account.email);

		await test.step('3. Création via suggestions BAN', async () => {
			await page.goto('/auth/settings/address/create', { waitUntil: 'domcontentloaded' });
			await expect(page.getByRole('heading', { name: 'Créer une adresse' })).toBeVisible();

			await fillStable(visibleNamedInput(page, 'first_name'), 'Pierre');
			await fillStable(visibleNamedInput(page, 'last_name'), 'Test');
			await fillStable(visibleNamedInput(page, 'phone', 'tel'), '+33612345678');
			await page.locator('input[name="address_search"]').fill(query);

			if (live) {
				const probe = await page.request.get(`/api/address-search?q=${encodeURIComponent(query)}`);
				expect(probe.ok()).toBeTruthy();
				const body = (await probe.json()) as { suggestions?: { formatted: string }[] };
				expect(body.suggestions?.length ?? 0).toBeGreaterThan(0);
				expect(body.suggestions?.[0]?.formatted).not.toBe(E2E_ADDRESS_SUGGESTIONS[0].formatted);

				await expect(
					page.getByRole('button', { name: body.suggestions![0].formatted })
				).toBeVisible({ timeout: 20_000 });
				await clickThroughOverlay(
					page.getByRole('button', { name: body.suggestions![0].formatted }).first()
				);
			} else {
				await expect(
					page.getByRole('button', { name: E2E_ADDRESS_SUGGESTIONS[0].formatted })
				).toBeVisible({ timeout: 15_000 });
				await clickThroughOverlay(
					page.getByRole('button', { name: E2E_ADDRESS_SUGGESTIONS[0].formatted }).first()
				);
			}

			const fillIfEmpty = async (name: string, value: string) => {
				const field = visibleNamedInput(page, name);
				if (!(await field.inputValue()).trim()) await fillStable(field, value);
			};
			await fillIfEmpty('street_number', '1');
			await fillIfEmpty('city', 'Toulouse');
			await fillIfEmpty('zip', '31000');
			await fillIfEmpty('country', 'France');

			await requestSubmitForm(page, '?/createAddress');
			await waitForPath(page, '/auth/settings/address');

			const addresses = await findAddressesByUserId(user.id);
			expect(addresses).toHaveLength(1);
			expect(addresses[0].city.toLowerCase()).toContain('toulouse');
			if (!live) {
				expect(addresses[0].zip).toBe('31000');
			} else {
				expect(addresses[0].zip).toMatch(/^31/);
			}
		});

		const victimEmail = `e2e-addr-victim-${Date.now()}@example.test`;
		await occupyEmail(victimEmail);
		const victim = await requireUser(victimEmail);
		const foreign = await createUserAddress(victim.id);

		try {
			await test.step('4. IDOR : fiche et suppression d’une adresse étrangère', async () => {
				const view = await page.request.get(`/auth/settings/address/${foreign.id}`);
				expect(view.status()).toBe(404);

				const origin = pageOrigin(page);
				const stolen = await page.request.post('/auth/settings/address?/deleteAddress', {
					form: { __superform_id: 'deleteAddress', id: foreign.id },
					headers: sveltekitActionHeaders(origin)
				});
				expect(stolen.status()).toBeLessThan(500);
				expect(await findAddressById(foreign.id)).not.toBeNull();
			});

			await test.step('5. Suppression de sa propre adresse', async () => {
				const own = (await findAddressesByUserId(user.id))[0];
				await page.goto('/auth/settings/address');
				// Pas de `clickThroughOverlay` (force: true) ici : ce bouton n'est
				// jamais couvert par la barre flottante, et `force` saute l'attente
				// d'actionabilité de Playwright — un clic peut alors partir avant que
				// l'hydratation Svelte n'ait attaché le handler, sans jamais soumettre
				// le formulaire (confirmé : un clic normal, qui attend que l'élément
				// soit stable, réussit systématiquement).
				await page.getByRole('button', { name: 'Delete address' }).click();
				await expect.poll(async () => findAddressById(own.id), { timeout: 15_000 }).toBeNull();
			});
		} finally {
			await deleteUser(victimEmail);
		}
	});
});
