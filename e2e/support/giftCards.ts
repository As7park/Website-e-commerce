import type { Page } from '@playwright/test';

/** Tableau Cartes cadeaux sur `/admin/gift-cards`. */
export function giftCardAdminTable(page: Page) {
	return page.locator('table').first();
}

export function giftCardAdminRow(page: Page, code: string) {
	return giftCardAdminTable(page).locator('tbody tr', { hasText: code });
}

export async function postValidateGiftCard(page: Page, body: { code: string; maxApplicable: number }) {
	const response = await page.request.post('/api/gift-cards/validate', { data: body });
	return { status: response.status(), json: await response.json() };
}
