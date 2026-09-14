import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';
import crypto from 'node:crypto';

const prisma = new PrismaClient();
const adminEmail = `scratch-admin-${Date.now()}@example.test`;
const adminToken = crypto.randomBytes(24).toString('hex');
const admin = await prisma.user.create({
	data: { email: adminEmail, username: 'scratch-admin', emailVerified: true, isMfaEnabled: false, role: 'ADMIN' }
});
await prisma.session.create({
	data: { id: adminToken, userId: admin.id, expiresAt: new Date(Date.now() + 3600_000), twoFactorVerified: true }
});
const product = await prisma.product.findFirst({ where: { material: { not: null } } });

const browser = await chromium.launch({
	executablePath: '/home/pierre/.cache/ms-playwright/chromium-1187/chrome-linux/chrome'
});
try {
	const consoleErrors = [];
	const ctx = await browser.newContext();
	await ctx.addCookies([{ name: 'auth_session', value: adminToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
	const page = await ctx.newPage();
	page.on('pageerror', (e) => consoleErrors.push(String(e)));
	page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
	page.on('response', async (res) => {
		if (res.url().includes(`/admin/products/${product.id}`) && res.request().method() === 'POST') {
			console.log('POST status:', res.status());
			try { console.log('POST body (first 800):', (await res.text()).slice(0, 800)); } catch {}
		}
	});
	await page.setViewportSize({ width: 1200, height: 1200 });
	await page.goto(`http://localhost:2000/admin/products/${product.id}`, { waitUntil: 'networkidle' });
	await page.waitForSelector('[aria-label="Chargement de l\'application"]', { state: 'detached', timeout: 5000 }).catch(() => {});

	await page.locator('button:has-text("Save changes")').click();
	await page.waitForTimeout(1000);
	console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
} finally {
	await browser.close();
	await prisma.session.deleteMany({ where: { userId: admin.id } });
	await prisma.user.delete({ where: { id: admin.id } });
	await prisma.$disconnect();
}
