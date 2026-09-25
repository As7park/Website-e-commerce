import { randomUUID } from 'node:crypto';
import type { APIResponse } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { waitForPath } from '../support/flows';
import { pageOrigin, signUpAndVerify } from '../support/admin';
import type { Account } from '../support/account';
import {
	createCatalogProduct,
	createUserAddress,
	deleteCatalogProduct,
	deleteUser,
	getFraudBlockByOrderId,
	getOrderById,
	getPendingOrder,
	getStoreFeatureFlags,
	getTransactionById,
	linkProductToOrder,
	promoteToAdmin,
	requireUser,
	setStoreFeatureFlags,
	setTransactionRisk,
	simulatePaidOrder
} from '../support/db';

/**
 * Détection de fraude (`StoreSettings.fraudDetectionEnabled`/
 * `fraudBlockingEnabled`) : score posé sur `Order` avant toute tentative de
 * paiement, blocage avant même la création de la session Stripe (jamais de
 * capture manuelle — voir docs/commerce/README.md pour ce choix). Les appels
 * à `?/checkout` ci-dessous sont réels (vraie session Stripe en mode test
 * pour le cas non bloqué), jamais mockés : c'est le point d'insertion
 * critique du blocage, il doit être prouvé en conditions réelles.
 */
async function addToCartAndGetPendingOrder(
	page: Parameters<typeof waitForPath>[0],
	productSlug: string,
	userId: string
) {
	await page.goto(`/products/${productSlug}`);
	const save = page.waitForResponse(
		(response) =>
			response.url().includes('/api/save-cart') && response.request().method() === 'POST'
	);
	await page.getByRole('button', { name: 'Ajouter au panier' }).click();
	await save;
	const pending = await getPendingOrder(userId);
	expect(pending).not.toBeNull();
	return pending!;
}

/**
 * `page.request.post` n'est pas une navigation de page : SvelteKit renvoie
 * alors le résultat d'une action `throw redirect(...)` comme un 200 avec un
 * corps JSON `{ type: 'redirect', status, location }` plutôt qu'une vraie
 * redirection HTTP (confirmé en conditions réelles, vraie session Stripe
 * créée dans les deux cas — seule la forme de la réponse diffère selon le
 * client). `error(...)`, lui, reste un vrai code HTTP quel que soit le
 * client (voir les étapes bloquées de ce même fichier).
 */
async function expectRedirectTo(response: APIResponse, substring: string) {
	expect(response.status()).toBe(200);
	const body = await response.json();
	expect(body.type).toBe('redirect');
	expect(body.status).toBe(303);
	expect(body.location).toContain(substring);
}

test.describe('Commerce — détection de fraude', () => {
	test.setTimeout(8 * 60_000);

	test('score persisté, blocage combiné vélocité + e-mail jetable, non bloquant si medium', async ({
		page,
		account,
		browser
	}) => {
		const originalFlags = await getStoreFeatureFlags();
		const created = await createCatalogProduct();
		const { product } = created;
		let disposableAccount: Account | null = null;

		try {
			await setStoreFeatureFlags({ fraudDetectionEnabled: true, fraudBlockingEnabled: true });

			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);
			const address = await createUserAddress(user.id);
			const origin = pageOrigin(page);
			// Un seul panier ajouté : le panier `PENDING` reste le même tant qu'il
			// n'est pas payé (une session Stripe ouverte sans paiement réel ne
			// change jamais son statut) — réutilisé tel quel par les étapes 1 et 2.
			const pending = await addToCartAndGetPendingOrder(page, product.slug, user.id);

			await test.step('1. Risque faible : checkout réel aboutit, score low persisté', async () => {
				const response = await page.request.post('/checkout?/checkout', {
					form: {
						orderId: pending.id,
						shippingAddressId: address.id,
						billingAddressId: address.id,
						shippingOption: 'no_shipping',
						shippingCost: '0',
						cgvAccepted: 'on'
					},
					headers: { Origin: origin },
					maxRedirects: 0
				});

				await expectRedirectTo(response, 'checkout.stripe.com');

				const order = await getOrderById(pending.id);
				expect(order?.riskLevel).toBe('low');
				expect(order?.riskScore).toBe(0);

				const block = await getFraudBlockByOrderId(pending.id);
				expect(block).toBeNull();
			});

			await test.step("2. Écart d'adresse (pays différent) : détecté mais pas bloquant (medium)", async () => {
				const foreignAddress = await createUserAddress(user.id, {
					country: 'Deutschland',
					country_code: 'DE',
					city: 'Berlin',
					zip: '10115'
				});

				const response = await page.request.post('/checkout?/checkout', {
					form: {
						orderId: pending.id,
						shippingAddressId: address.id,
						billingAddressId: foreignAddress.id,
						shippingOption: 'no_shipping',
						shippingCost: '0',
						cgvAccepted: 'on'
					},
					headers: { Origin: origin },
					maxRedirects: 0
				});

				await expectRedirectTo(response, 'checkout.stripe.com');

				const order = await getOrderById(pending.id);
				expect(order?.riskLevel).toBe('medium');
				expect(order?.riskScore).toBe(30);
				expect(order?.riskFactors).toContain('Écart adresse facturation/livraison');
			});

			await test.step('3. Vélocité + e-mail jetable combinés (score 70) : commande bloquée avant Stripe', async () => {
				const id = randomUUID().slice(0, 8);
				disposableAccount = {
					email: `e2e-${id}@mailinator.com`,
					username: `e2e_${id}`,
					password: 'Sup3rSecret!2026'
				};

				// Contexte navigateur isolé : le compte jetable doit s'authentifier
				// pour son propre checkout (`locals.user` requis), sans jamais
				// remplacer la session de `account` sur `page` (réutilisée ensuite
				// pour les étapes admin).
				const riskyContext = await browser.newContext();
				const riskyPage = await riskyContext.newPage();
				try {
					await signUpAndVerify(riskyPage, disposableAccount);
					const riskyUser = await requireUser(disposableAccount.email);
					const riskyAddress = await createUserAddress(riskyUser.id);
					const riskyOrigin = pageOrigin(riskyPage);

					// 3 transactions payées récentes → facteur vélocité (+40).
					for (let i = 0; i < 3; i++) {
						const linked = await linkProductToOrder(riskyUser.id, product.id);
						await simulatePaidOrder(linked.order.id, riskyUser.id, disposableAccount.email);
					}

					const pending = await addToCartAndGetPendingOrder(riskyPage, product.slug, riskyUser.id);

					const response = await riskyPage.request.post('/checkout?/checkout', {
						form: {
							orderId: pending.id,
							shippingAddressId: riskyAddress.id,
							billingAddressId: riskyAddress.id,
							shippingOption: 'no_shipping',
							shippingCost: '0',
							cgvAccepted: 'on'
						},
						headers: { Origin: riskyOrigin },
						maxRedirects: 0
					});

					expect(response.status()).toBe(403);

					const order = await getOrderById(pending.id);
					expect(order?.riskLevel).toBe('high');
					expect(order?.riskScore).toBe(70);
					expect(order?.riskFactors).toEqual(
						expect.arrayContaining(['Vélocité de commandes', 'E-mail jetable'])
					);

					const block = await getFraudBlockByOrderId(pending.id);
					expect(block).not.toBeNull();
					expect(block?.riskLevel).toBe('high');
					expect(block?.email).toBe(disposableAccount.email);
				} finally {
					await riskyContext.close();
				}

				await test.step('3b. Visible dans /admin/fraud', async () => {
					await promoteToAdmin(account.email);
					await page.goto(`/admin/fraud?q=${encodeURIComponent(disposableAccount!.email)}`);
					await waitForPath(page, '/admin/fraud');
					// `Table.svelte` rend simultanément une vue desktop (table) et une
					// vue mobile (cartes) — l'une des deux est masquée en CSS mais toutes
					// deux existent dans le DOM, d'où `.first()` pour lever l'ambiguïté.
					await expect(page.getByText(disposableAccount!.email).first()).toBeVisible();
				});
			});

			await test.step('4. Badge de risque visible dans /admin/sales', async () => {
				const linked = await linkProductToOrder(user.id, product.id);
				const transaction = await simulatePaidOrder(linked.order.id, user.id, account.email);
				await setTransactionRisk(transaction.id, {
					riskScore: 72,
					riskLevel: 'high',
					riskFactors: ['Vélocité de commandes']
				});

				// Filtré par l'e-mail du compte : la table trie par défaut sur
				// `createdAt` croissant (`normalizeListParams`), une nouvelle ligne
				// n'apparaîtrait pas forcément sur la première page sans ce filtre.
				await page.goto(`/admin/sales?q=${encodeURIComponent(account.email)}`);
				await waitForPath(page, '/admin/sales');
				await expect(page.getByText('Élevé (72)').first()).toBeVisible();

				const stored = await getTransactionById(transaction.id);
				expect(stored?.riskLevel).toBe('high');
			});
		} finally {
			await setStoreFeatureFlags(originalFlags);
			await deleteCatalogProduct(product.id);
			if (disposableAccount) await deleteUser((disposableAccount as Account).email);
		}
	});
});
