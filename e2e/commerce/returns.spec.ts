import { test, expect } from '../support/fixtures';
import { expectMessage, waitForPath } from '../support/flows';
import { signUpAndVerify } from '../support/admin';
import {
	createCatalogProduct,
	deleteCatalogProduct,
	deleteTransaction,
	deleteUser,
	getReturnRequestByTransactionId,
	getStoreFeatureFlags,
	linkProductToOrder,
	occupyEmail,
	promoteToAdmin,
	requireUser,
	setStoreFeatureFlags,
	simulatePaidOrder
} from '../support/db';

/**
 * Retours/SAV : module activable (`StoreSettings.returnsEnabled`, 404 partout
 * si désactivé), demande côté compte, traitement admin (page dédiée, pas
 * `Table.svelte`). Le remboursement Stripe réel (approbation) n'est pas
 * rejouable ici : `simulatePaidOrder` ne crée pas de vraie Checkout Session,
 * donc `stripe.checkout.sessions.retrieve` échoue toujours — on vérifie que
 * ce cas est géré proprement (message d'erreur, pas de 500 muet), pas le
 * remboursement lui-même.
 *
 * `StoreSettings` est une ligne unique partagée par toute la suite : les
 * valeurs d'origine sont restaurées en `finally`.
 */
test.describe('Retours / SAV', () => {
	test.setTimeout(6 * 60_000);

	test('module désactivé ferme les routes compte', async ({ page, account }) => {
		const originalFlags = await getStoreFeatureFlags();
		try {
			await setStoreFeatureFlags({ returnsEnabled: false });
			await signUpAndVerify(page, account);

			let response = await page.goto('/auth/settings/returns');
			expect(response?.status()).toBe(404);

			response = await page.goto('/auth/settings/returns/placeholder');
			expect(response?.status()).toBe(404);
		} finally {
			await setStoreFeatureFlags(originalFlags);
		}
	});

	test('demande, traitement admin', async ({ page, account }) => {
		const originalFlags = await getStoreFeatureFlags();
		const created = await createCatalogProduct();
		const { product } = created;
		let transactionId: string | undefined;

		try {
			await setStoreFeatureFlags({ returnsEnabled: true });
			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);
			const linked = await linkProductToOrder(user.id, product.id);
			const sale = await simulatePaidOrder(linked.order.id, user.id, account.email);
			transactionId = sale.id;

			await test.step('1. La commande apparaît, éligible au retour', async () => {
				await page.goto('/auth/settings/returns');
				await expect(page.getByRole('link', { name: 'Demander un retour' })).toBeVisible();
			});

			await test.step('2. Le motif est envoyé', async () => {
				await page.goto(`/auth/settings/returns/${transactionId}`);
				await page.locator('textarea[name="reason"]').fill('Produit reçu endommagé.');
				await page.getByRole('button', { name: 'Envoyer la demande' }).click();
				await expect(page.getByText('En attente de traitement')).toBeVisible();

				const request = await getReturnRequestByTransactionId(transactionId!);
				expect(request?.status).toBe('REQUESTED');
				expect(request?.reason).toBe('Produit reçu endommagé.');
			});

			await test.step("3. Une seconde demande n'est pas proposée", async () => {
				await page.goto(`/auth/settings/returns/${transactionId}`);
				await expect(page.locator('textarea[name="reason"]')).toHaveCount(0);
				await expect(page.getByText('En attente de traitement')).toBeVisible();
			});

			await promoteToAdmin(account.email);

			await test.step('4. La demande est visible et refusable côté admin', async () => {
				await page.goto('/admin/returns');
				await waitForPath(page, '/admin/returns');
				await expect(page.getByText('Produit reçu endommagé.')).toBeVisible();

				await page.getByRole('button', { name: 'Refuser' }).click();
				await page.getByRole('button', { name: 'Confirmer le refus' }).click();
				await expect(page.getByText('Refusée')).toBeVisible();

				const request = await getReturnRequestByTransactionId(transactionId!);
				expect(request?.status).toBe('REJECTED');
			});
		} finally {
			await setStoreFeatureFlags(originalFlags);
			if (transactionId) await deleteTransaction(transactionId);
			await deleteCatalogProduct(product.id);
		}
	});

	test('approbation gère un remboursement Stripe impossible sans planter', async ({
		page,
		account
	}) => {
		const originalFlags = await getStoreFeatureFlags();
		const created = await createCatalogProduct();
		const { product } = created;
		let transactionId: string | undefined;

		try {
			await setStoreFeatureFlags({ returnsEnabled: true });
			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);
			const linked = await linkProductToOrder(user.id, product.id);
			const sale = await simulatePaidOrder(linked.order.id, user.id, account.email);
			transactionId = sale.id;

			await page.goto(`/auth/settings/returns/${transactionId}`);
			await page.locator('textarea[name="reason"]').fill('Article non conforme.');
			await page.getByRole('button', { name: 'Envoyer la demande' }).click();
			await expect(page.getByText('En attente de traitement')).toBeVisible();

			await promoteToAdmin(account.email);
			await page.goto('/admin/returns');
			await page.getByRole('button', { name: 'Approuver + rembourser' }).click();
			await page.getByRole('button', { name: 'Confirmer le remboursement' }).click();

			await expectMessage(page, 'Échec du remboursement Stripe');
			const request = await getReturnRequestByTransactionId(transactionId!);
			expect(request?.status).toBe('REQUESTED');
		} finally {
			await setStoreFeatureFlags(originalFlags);
			if (transactionId) await deleteTransaction(transactionId);
			await deleteCatalogProduct(product.id);
		}
	});

	test('IDOR : un compte ne voit pas la demande d’un autre', async ({ page, account }) => {
		const originalFlags = await getStoreFeatureFlags();
		const created = await createCatalogProduct();
		const { product } = created;
		const otherEmail = `e2e-returns-other-${Date.now()}@example.test`;
		await occupyEmail(otherEmail);
		const other = await requireUser(otherEmail);
		const linked = await linkProductToOrder(other.id, product.id);
		const sale = await simulatePaidOrder(linked.order.id, other.id, otherEmail);

		try {
			await setStoreFeatureFlags({ returnsEnabled: true });
			await signUpAndVerify(page, account);
			const response = await page.goto(`/auth/settings/returns/${sale.id}`);
			expect(response?.status()).toBe(404);
		} finally {
			await setStoreFeatureFlags(originalFlags);
			await deleteTransaction(sale.id);
			await deleteUser(otherEmail);
			await deleteCatalogProduct(product.id);
		}
	});
});
