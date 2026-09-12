import { chromium } from 'playwright';

const BASE = 'http://localhost:2002';
const email = `diag-${Date.now()}@example.test`;

const browser = await chromium.launch();
const page = await browser.newPage();

const pending = new Map();
page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('requestfailed', (req) => console.log('[requestfailed]', req.url(), req.failure()?.errorText));
page.on('request', (req) => {
	pending.set(req.url(), Date.now());
});
page.on('requestfinished', (req) => {
	pending.delete(req.url());
});
page.on('response', (res) => {
	console.log('[response]', res.status(), res.url());
});

console.log('goto /auth/signup ...');
await page.goto(`${BASE}/auth/signup`, { timeout: 30000 });
console.log('loaded, pending requests:', [...pending.keys()]);

await page.waitForTimeout(2000);
console.log('after 2s, still pending:', [...pending.keys()]);

await page.locator('input[name="username"]').fill('diaguser' + Date.now());
await page.locator('input[name="email"]').fill(email);
await page.locator('input[name="password"]').fill('DiagPass!2026xyz');

console.log('clicking submit at', Date.now());
const start = Date.now();
await page.getByRole('button', { name: "S'inscrire" }).click();

try {
	await page.waitForURL((url) => url.pathname.startsWith('/auth/verify-email'), { timeout: 30000 });
	console.log('SUCCESS: reached verify-email after', Date.now() - start, 'ms');
} catch (e) {
	console.log('TIMEOUT/FAIL after', Date.now() - start, 'ms:', e.message);
	console.log('current url:', page.url());
}

await browser.close();
