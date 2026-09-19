import { test, expect } from '../support/fixtures';
import { signUpAndVerify } from '../support/admin';
import {
	checkoutSessionCompletedPayload,
	chargeDisputePayload,
	signStripePayload
} from '../support/stripe';
import {
	attachOrderAddress,
	createCatalogProduct,
	createUserAddress,
	deleteCatalogProduct,
	deleteTransaction,
	getTransactionByStripePaymentId,
	linkProductToOrder,
	requireUser
} from '../support/db';
import { clearMailbox, fetchMailbox, waitForEmailContaining } from '../support/mailbox';

const DISPUTE_RECIPIENT = process.env.DISPUTE_ALERT_EMAIL!;

/**
 * Litige Stripe (`charge.dispute.created`/`.closed`, webhook `/api/webhooks`).
 *
 * Le rattachement à la transaction se fait via `stripePaymentIntentId` (posé
 * au paiement, jamais un appel Stripe supplémentaire) — le payload de test
 * fournit donc le même `paymentIntentId` aux deux évènements.
 */
test.describe('Commerce — litige Stripe', () => {
	test.setTimeout(3 * 60_000);

	test('ouverture puis clôture : transaction taguée, alerte e-mail envoyée une fois par phase', async ({
		page,
		account
	}) => {
		const created = await createCatalogProduct();
		const { product } = created;
		const sessionId = `e2e-cs-dispute-${Date.now()}`;
		const paymentIntentId = `e2e-pi-dispute-${Date.now()}`;
		const disputeId = `e2e-dp-${Date.now()}`;
		let transactionId: string | undefined;

		try {
			await signUpAndVerify(page, account);
			const user = await requireUser(account.email);
			const address = await createUserAddress(user.id);
			const linked = await linkProductToOrder(user.id, product.id);
			await attachOrderAddress(linked.order.id, address.id);

			await test.step('1. Paiement (checkout.session.completed)', async () => {
				const payload = checkoutSessionCompletedPayload({
					sessionId,
					orderId: linked.order.id,
					email: account.email,
					paymentIntentId
				});
				const response = await page.request.post('/api/webhooks', {
					headers: {
						'content-type': 'application/json',
						'stripe-signature': signStripePayload(payload)
					},
					data: payload
				});
				expect(response.status()).toBe(200);

				const transaction = await getTransactionByStripePaymentId(sessionId);
				expect(transaction).not.toBeNull();
				transactionId = transaction!.id;
			});

			await test.step('2. charge.dispute.created : transaction taguée + e-mail', async () => {
				await clearMailbox();
				const payload = chargeDisputePayload({
					disputeId,
					paymentIntentId,
					eventType: 'charge.dispute.created',
					status: 'needs_response'
				});
				const response = await page.request.post('/api/webhooks', {
					headers: {
						'content-type': 'application/json',
						'stripe-signature': signStripePayload(payload)
					},
					data: payload
				});
				expect(response.status()).toBe(200);

				const transaction = await getTransactionByStripePaymentId(sessionId);
				expect(transaction?.disputeId).toBe(disputeId);
				expect(transaction?.disputeStatus).toBe('needs_response');
				expect(transaction?.disputeClosedAt).toBeNull();

				const mail = await waitForEmailContaining(DISPUTE_RECIPIENT, 'Litige Stripe ouvert');
				expect(mail.raw).toContain(transactionId!);
			});

			await test.step('3. Retry du même évènement : pas de second e-mail', async () => {
				await clearMailbox();
				const payload = chargeDisputePayload({
					disputeId,
					paymentIntentId,
					eventType: 'charge.dispute.created',
					status: 'needs_response'
				});
				const response = await page.request.post('/api/webhooks', {
					headers: {
						'content-type': 'application/json',
						'stripe-signature': signStripePayload(payload)
					},
					data: payload
				});
				expect(response.status()).toBe(200);
				await expect(async () => {
					const inbox = await fetchMailbox();
					expect(inbox).toHaveLength(0);
				}).toPass({ timeout: 3_000 });
			});

			await test.step('4. charge.dispute.closed : clôture + e-mail dédié', async () => {
				await clearMailbox();
				const payload = chargeDisputePayload({
					disputeId,
					paymentIntentId,
					eventType: 'charge.dispute.closed',
					status: 'won'
				});
				const response = await page.request.post('/api/webhooks', {
					headers: {
						'content-type': 'application/json',
						'stripe-signature': signStripePayload(payload)
					},
					data: payload
				});
				expect(response.status()).toBe(200);

				const transaction = await getTransactionByStripePaymentId(sessionId);
				expect(transaction?.disputeStatus).toBe('won');
				expect(transaction?.disputeClosedAt).not.toBeNull();

				const mail = await waitForEmailContaining(DISPUTE_RECIPIENT, 'Litige Stripe clos');
				expect(mail.raw).toContain(transactionId!);
			});
		} finally {
			if (transactionId) await deleteTransaction(transactionId);
			await deleteCatalogProduct(product.id);
		}
	});
});
