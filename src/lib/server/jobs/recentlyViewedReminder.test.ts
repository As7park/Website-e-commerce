import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Vérifie le job de relance « produits consultés, jamais achetés » : flag
 * désactivé → no-op, vue trop récente exclue, produit déjà acheté exclu,
 * digest plafonné, jamais un second envoi pour une ligne déjà relancée.
 * `sendMail`/Prisma mockés ; `withLock`/`withDuration` réels (repli en
 * mémoire sans Redis configuré, même convention que `post-payment.test.ts`).
 */

const productViewFindMany = vi.fn();
const productViewUpdateMany = vi.fn();
const orderItemFindMany = vi.fn().mockResolvedValue([]);
const sendMail = vi.fn().mockResolvedValue(undefined);
const getStoreFeatureFlags = vi.fn();

vi.mock('$lib/server', () => ({
	prisma: {
		productView: { findMany: productViewFindMany, updateMany: productViewUpdateMany },
		orderItem: { findMany: orderItemFindMany }
	}
}));
vi.mock('$lib/server/smtp-mail', () => ({ sendMail }));
vi.mock('$lib/server/storeSettings', () => ({ getStoreFeatureFlags }));

function view(overrides: Partial<{
	id: string;
	userId: string;
	productId: string;
	viewedAt: Date;
	email: string;
	productName: string;
	productSlug: string;
}> = {}) {
	return {
		id: overrides.id ?? 'view_1',
		userId: overrides.userId ?? 'user_1',
		productId: overrides.productId ?? 'product_1',
		viewedAt: overrides.viewedAt ?? new Date(Date.now() - 48 * 60 * 60 * 1000),
		user: { id: overrides.userId ?? 'user_1', email: overrides.email ?? 'client@example.com' },
		product: { name: overrides.productName ?? 'Bague Solitaire', slug: overrides.productSlug ?? 'bague-solitaire' }
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	getStoreFeatureFlags.mockResolvedValue({ recentlyViewedReminderEnabled: true });
	orderItemFindMany.mockResolvedValue([]);
	productViewFindMany.mockResolvedValue([]);
	// Ré-interrogé sous verrou : par défaut, la ligne sélectionnée existe
	// toujours et n'a pas été relancée entre-temps.
	productViewFindMany.mockImplementation(async (args: any) => {
		if (args?.where?.id?.in) {
			return args.where.id.in.map((id: string) => ({ id, productId: 'product_1' }));
		}
		return [];
	});
});

afterEach(() => {
	vi.resetModules();
});

describe('runRecentlyViewedReminderJob', () => {
	it('module désactivé : aucune sélection, aucun e-mail', async () => {
		getStoreFeatureFlags.mockResolvedValue({ recentlyViewedReminderEnabled: false });
		const { runRecentlyViewedReminderJob } = await import('./recentlyViewedReminder');

		const result = await runRecentlyViewedReminderJob();

		expect(result).toEqual({ enabled: false, sent: 0, durationMs: expect.any(Number) });
		expect(sendMail).not.toHaveBeenCalled();
	});

	it("sélectionne les vues d'au moins 24h avec reminderSentAt null, envoie un digest", async () => {
		productViewFindMany.mockImplementation(async (args: any) => {
			if (args?.where?.id?.in) {
				return args.where.id.in.map((id: string) => ({ id, productId: 'product_1' }));
			}
			// Requête initiale : vérifie le filtre demandé.
			expect(args.where.reminderSentAt).toBeNull();
			expect(args.where.viewedAt.lte).toBeInstanceOf(Date);
			return [view()];
		});

		const { runRecentlyViewedReminderJob } = await import('./recentlyViewedReminder');
		const result = await runRecentlyViewedReminderJob();

		expect(result.sent).toBe(1);
		expect(sendMail).toHaveBeenCalledTimes(1);
		const call = sendMail.mock.calls[0][0];
		expect(call.to).toBe('client@example.com');
		expect(call.html).toContain('bague-solitaire');
		expect(productViewUpdateMany).toHaveBeenCalledWith({
			where: { id: { in: ['view_1'] } },
			data: { reminderSentAt: expect.any(Date) }
		});
	});

	it('produit déjà acheté (PAID/SHIPPED) : jamais dans le digest, aucun envoi si seul candidat', async () => {
		productViewFindMany.mockImplementation(async (args: any) => {
			if (args?.where?.id?.in) {
				return args.where.id.in.map((id: string) => ({ id, productId: 'product_1' }));
			}
			return [view()];
		});
		orderItemFindMany.mockResolvedValue([{ productId: 'product_1' }]);

		const { runRecentlyViewedReminderJob } = await import('./recentlyViewedReminder');
		const result = await runRecentlyViewedReminderJob();

		expect(result.sent).toBe(0);
		expect(sendMail).not.toHaveBeenCalled();
		expect(productViewUpdateMany).not.toHaveBeenCalled();
	});

	it('digest plafonné à 5 produits pour un même compte', async () => {
		const views = Array.from({ length: 8 }, (_, i) =>
			view({ id: `view_${i}`, productId: `product_${i}`, productSlug: `produit-${i}` })
		);
		productViewFindMany.mockImplementation(async (args: any) => {
			if (args?.where?.id?.in) {
				return args.where.id.in.map((id: string) => ({ id, productId: id.replace('view', 'product') }));
			}
			return views;
		});

		const { runRecentlyViewedReminderJob } = await import('./recentlyViewedReminder');
		await runRecentlyViewedReminderJob();

		const call = sendMail.mock.calls[0][0];
		const linkCount = (call.html.match(/<li>/g) || []).length;
		expect(linkCount).toBe(5);
	});

	it('retry : une ligne déjà relancée (filtrée par la re-vérification sous verrou) ne renvoie jamais', async () => {
		productViewFindMany.mockImplementation(async (args: any) => {
			if (args?.where?.id?.in) {
				// Simule une ligne déjà marquée `reminderSentAt` entre la sélection
				// initiale et l'exécution sous verrou : re-vérification la filtre.
				return [];
			}
			return [view()];
		});

		const { runRecentlyViewedReminderJob } = await import('./recentlyViewedReminder');
		const result = await runRecentlyViewedReminderJob();

		expect(result.sent).toBe(0);
		expect(sendMail).not.toHaveBeenCalled();
	});

	it('deux comptes distincts avec des candidats reçoivent chacun leur propre digest', async () => {
		productViewFindMany.mockImplementation(async (args: any) => {
			if (args?.where?.id?.in) {
				return args.where.id.in.map((id: string) => ({ id, productId: 'product_1' }));
			}
			return [
				view({ id: 'view_a', userId: 'user_a', email: 'a@example.com' }),
				view({ id: 'view_b', userId: 'user_b', email: 'b@example.com' })
			];
		});

		const { runRecentlyViewedReminderJob } = await import('./recentlyViewedReminder');
		const result = await runRecentlyViewedReminderJob();

		expect(result.sent).toBe(2);
		expect(sendMail).toHaveBeenCalledTimes(2);
		const recipients = sendMail.mock.calls.map((call) => call[0].to).sort();
		expect(recipients).toEqual(['a@example.com', 'b@example.com']);
	});
});
