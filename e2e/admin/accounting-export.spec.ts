import { test, expect } from '../support/fixtures';
import {
	createCatalogProduct,
	deleteAccountingExportLog,
	deleteCatalogProduct,
	deleteTransaction,
	deleteUser,
	linkProductToOrder,
	occupyEmail,
	requireUser,
	setTransactionCreatedAt,
	simulatePaidOrder
} from '../support/db';
import { clearMailbox, waitForEmailContaining, fetchMailbox } from '../support/mailbox';

const CRON_HEADERS = { authorization: `Bearer ${process.env.CRON_SECRET}` };
const RECIPIENT = process.env.ACCOUNTING_EXPORT_EMAIL!;

/**
 * Export comptable mensuel : scan périodique
 * (`$lib/server/jobs/accountingExport.ts`, route
 * `/api/jobs/accounting-export`), pas un job déclenché par une action
 * utilisateur — on appelle donc directement la route, même en-tête
 * `CRON_SECRET` que Vercel Cron en repli sans QStash (voir
 * `assertAuthorized`, identique à `/api/jobs/cleanup`).
 *
 * `Transaction.createdAt` est reculé au mois calendaire précédent
 * (`setTransactionCreatedAt`) : le job calcule toujours « le mois précédent
 * par rapport à maintenant », donc placer une transaction ailleurs qu'à ce
 * mois-là la rendrait invisible à l'export.
 */
test.describe('Export comptable mensuel', () => {
	test.setTimeout(60_000);

	test('génère et envoie l’export une seule fois (rejeu sans second e-mail)', async ({ page }) => {
		const created = await createCatalogProduct();
		const { product } = created;
		const email = `e2e-accounting-export-${Date.now()}@example.test`;

		await occupyEmail(email);
		const user = await requireUser(email);
		const linked = await linkProductToOrder(user.id, product.id);
		const sale = await simulatePaidOrder(linked.order.id, user.id, email);

		const now = new Date();
		const previousMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
		const expectedLabel = `${previousMonthDate.getUTCFullYear()}-${String(
			previousMonthDate.getUTCMonth() + 1
		).padStart(2, '0')}`;

		try {
			await setTransactionCreatedAt(sale.id, previousMonthDate);
			await deleteAccountingExportLog(expectedLabel);
			await clearMailbox();
			await test.step('1. Premier appel : export envoyé', async () => {
				const response = await page.request.post('/api/jobs/accounting-export', {
					headers: CRON_HEADERS
				});
				expect(response.status()).toBe(200);
				const body = await response.json();
				expect(body.sent).toBe(true);
				expect(body.period).toBe(expectedLabel);
				expect(body.transactionCount).toBeGreaterThanOrEqual(1);

				const mail = await waitForEmailContaining(RECIPIENT, 'Export comptable');
				expect(mail.raw).toContain(`export-comptable-${expectedLabel}.csv`);
				expect(mail.raw).toContain('text/csv');
			});

			await test.step('2. Rejouer le job tout de suite : pas de second e-mail', async () => {
				await clearMailbox();
				const response = await page.request.post('/api/jobs/accounting-export', {
					headers: CRON_HEADERS
				});
				expect(response.status()).toBe(200);
				const body = await response.json();
				expect(body.sent).toBe(false);
				expect(await fetchMailbox()).toHaveLength(0);
			});
		} finally {
			await deleteAccountingExportLog(expectedLabel);
			await deleteTransaction(sale.id);
			await deleteCatalogProduct(product.id);
			await deleteUser(email);
		}
	});
});
