import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';
import crypto from 'node:crypto';

const prisma = new PrismaClient();
const adminEmail = `scratch-admin-${Date.now()}@example.test`;
const clientEmail = `scratch-client-${Date.now()}@example.test`;
const adminToken = crypto.randomBytes(24).toString('hex');
const clientToken = crypto.randomBytes(24).toString('hex');

const admin = await prisma.user.create({
	data: { email: adminEmail, username: 'scratch-admin', emailVerified: true, isMfaEnabled: false, role: 'ADMIN' }
});
const client = await prisma.user.create({
	data: { email: clientEmail, username: 'scratch-reviewer', emailVerified: true, isMfaEnabled: false, role: 'CLIENT' }
});
await prisma.session.createMany({
	data: [
		{ id: adminToken, userId: admin.id, expiresAt: new Date(Date.now() + 3600_000), twoFactorVerified: true },
		{ id: clientToken, userId: client.id, expiresAt: new Date(Date.now() + 3600_000), twoFactorVerified: true }
	]
});

const product = await prisma.product.findFirst({ where: { material: { not: null } } });

// pre-create a review to moderate
await prisma.review.create({
	data: { productId: product.id, userId: client.id, rating: 1, comment: 'Faux avis à modérer' }
});

const browser = await chromium.launch({
	executablePath: '/home/pierre/.cache/ms-playwright/chromium-1187/chrome-linux/chrome'
});
try {
	const consoleErrors = [];
	async function gotoAndSettle(page, url) {
		await page.goto(url, { waitUntil: 'networkidle' });
		await page.waitForSelector('[aria-label="Chargement de l\'application"]', { state: 'detached', timeout: 5000 }).catch(() => {});
		await page.waitForTimeout(200);
	}

	// 1) Admin reviews moderation page
	const adminCtx = await browser.newContext();
	await adminCtx.addCookies([{ name: 'auth_session', value: adminToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
	const pAdmin = await adminCtx.newPage();
	pAdmin.on('pageerror', (e) => consoleErrors.push('admin-reviews: ' + e));
	await pAdmin.setViewportSize({ width: 1200, height: 900 });
	await gotoAndSettle(pAdmin, 'http://localhost:2000/admin/products/reviews');
	await pAdmin.screenshot({ path: '/tmp/admin-reviews-list.png', fullPage: true });

	// delete the review (row containing our seeded review, last action button = trash)
	await pAdmin.locator('tr:has-text("Elegant Plastic Tuna") button').last().click();
	await pAdmin.waitForTimeout(300);
	await pAdmin.screenshot({ path: '/tmp/admin-reviews-confirm-dialog.png', fullPage: true });
	await pAdmin.getByRole('button', { name: 'Continue' }).last().click();
	await pAdmin.waitForTimeout(600);
	await pAdmin.screenshot({ path: '/tmp/admin-reviews-after-delete.png', fullPage: true });
	await adminCtx.close();

	const remaining = await prisma.review.count({ where: { productId: product.id, userId: client.id } });
	console.log('reviews remaining after admin delete (expect 0):', remaining);

	// 2) compareAtPrice validation on admin product edit form
	const adminCtx2 = await browser.newContext();
	await adminCtx2.addCookies([{ name: 'auth_session', value: adminToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
	const pEdit = await adminCtx2.newPage();
	pEdit.on('pageerror', (e) => consoleErrors.push('admin-edit: ' + e));
	await pEdit.setViewportSize({ width: 1200, height: 1200 });
	await gotoAndSettle(pEdit, `http://localhost:2000/admin/products/${product.id}`);

	// set an invalid compareAtPrice (lower than price)
	const priceValue = await pEdit.locator('input[name="price"]').inputValue();
	await pEdit.locator('input[name="compareAtPrice"]').fill(String(Number(priceValue) - 1));
	await pEdit.locator('button:has-text("Save changes")').click();
	await pEdit.waitForTimeout(600);
	await pEdit.screenshot({ path: '/tmp/admin-compareprice-invalid.png', fullPage: true });

	// check material datalist options are present
	const datalistCount = await pEdit.locator('#material-suggestions option').count();
	console.log('material datalist option count:', datalistCount);

	await adminCtx2.close();

	console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
} finally {
	await browser.close();
	for (const u of [admin, client]) {
		await prisma.session.deleteMany({ where: { userId: u.id } });
		await prisma.review.deleteMany({ where: { userId: u.id } });
		await prisma.wishlistItem.deleteMany({ where: { userId: u.id } });
		await prisma.order.deleteMany({ where: { userId: u.id } });
		await prisma.user.delete({ where: { id: u.id } });
	}
	await prisma.$disconnect();
}
