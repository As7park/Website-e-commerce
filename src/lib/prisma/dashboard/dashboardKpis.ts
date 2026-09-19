/**
 * KPIs complémentaires du dashboard admin (`/admin`), au-delà des ventes déjà
 * couvertes par `getAllTransactionsDashboard`. Chaque métrique est une seule
 * agrégation Prisma (`count`/`aggregate`/`groupBy`), jamais un `findMany` de
 * toutes les lignes : le coût et le payload restent constants quel que soit
 * le volume en base.
 */
import { prisma } from '$lib/server';
import type { OrderStatus } from '@prisma/client';
import { LOW_STOCK_THRESHOLD } from '$lib/prisma/products/products';

/** Fenêtre des KPI liés à l'activité récente (ventes, relances, nouveaux
 * comptes, engagement) — les compteurs de file d'attente (stock, retours,
 * questions) et les métriques de fidélité client restent, eux, sans fenêtre
 * temporelle : ce sont des états courants ou cumulatifs, pas des tendances. */
const RECENT_WINDOW_DAYS = 30;
const LOW_STOCK_SAMPLE_LIMIT = 5;
const PROMO_EXPIRY_WARNING_DAYS = 7;

const ORDER_STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'SHIPPED', 'CANCELLED'];

export async function getDashboardKpis() {
	const since = new Date();
	since.setDate(since.getDate() - RECENT_WINDOW_DAYS);

	const expiryWarningDate = new Date();
	expiryWarningDate.setDate(expiryWarningDate.getDate() + PROMO_EXPIRY_WARNING_DAYS);

	const [
		paidAggregate,
		abandonedCartsCount,
		cartRemindersSentCount,
		cartRemindersRecoveredCount,
		lowStockCount,
		lowStockSample,
		pendingReturnsCount,
		unansweredQuestionsCount,
		ordersByStatusRaw,
		newCustomersCount,
		paidOrdersByCustomer,
		neverSoldProductsCount,
		reviewAggregate,
		newReviewsCount,
		soonExpiringPromoCodesCount,
		giftCardOutstandingAggregate,
		loyaltyAwardsCount,
		newContactSubmissionsCount
	] = await Promise.all([
		prisma.order.aggregate({
			where: { status: 'PAID', createdAt: { gte: since } },
			_avg: { total: true },
			_count: true
		}),
		prisma.order.count({ where: { status: 'PENDING', createdAt: { gte: since } } }),
		prisma.order.count({
			where: {
				createdAt: { gte: since },
				OR: [{ cartReminder1SentAt: { not: null } }, { cartReminder2SentAt: { not: null } }]
			}
		}),
		prisma.order.count({
			where: {
				createdAt: { gte: since },
				status: 'PAID',
				OR: [{ cartReminder1SentAt: { not: null } }, { cartReminder2SentAt: { not: null } }]
			}
		}),
		prisma.product.count({ where: { stock: { lte: LOW_STOCK_THRESHOLD } } }),
		prisma.product.findMany({
			where: { stock: { lte: LOW_STOCK_THRESHOLD } },
			orderBy: { stock: 'asc' },
			take: LOW_STOCK_SAMPLE_LIMIT,
			select: { id: true, name: true, stock: true, slug: true }
		}),
		prisma.returnRequest.count({ where: { status: 'REQUESTED' } }),
		prisma.productQuestion.count({ where: { answeredAt: null } }),
		prisma.order.groupBy({
			by: ['status'],
			where: { createdAt: { gte: since } },
			_count: { _all: true }
		}),
		prisma.user.count({ where: { role: 'CLIENT', createdAt: { gte: since } } }),
		// Un groupe par client payeur (pas une ligne par commande) : reste léger
		// même sur un historique de vente important.
		prisma.order.groupBy({ by: ['userId'], where: { status: 'PAID' }, _count: { _all: true } }),
		prisma.product.count({ where: { orderItems: { none: {} } } }),
		prisma.review.aggregate({ _avg: { rating: true }, _count: true }),
		prisma.review.count({ where: { createdAt: { gte: since } } }),
		prisma.promoCode.count({
			where: { active: true, expiresAt: { gte: new Date(), lte: expiryWarningDate } }
		}),
		prisma.giftCard.aggregate({ where: { active: true }, _sum: { balance: true } }),
		prisma.loyaltyAward.count({ where: { createdAt: { gte: since } } }),
		prisma.contactSubmission.count({ where: { createdAt: { gte: since } } })
	]);

	const ordersByStatus = Object.fromEntries(
		ORDER_STATUSES.map((status) => [
			status,
			ordersByStatusRaw.find((row) => row.status === status)?._count._all ?? 0
		])
	) as Record<OrderStatus, number>;

	return {
		windowDays: RECENT_WINDOW_DAYS,
		averageOrderValue: paidAggregate._avg.total ?? 0,
		paidOrdersCount: paidAggregate._count,
		abandonedCartsCount,
		cartRemindersSentCount,
		cartRemindersRecoveredCount,
		lowStockCount,
		lowStockSample,
		pendingReturnsCount,
		unansweredQuestionsCount,
		ordersByStatus,
		newCustomersCount,
		payingCustomersCount: paidOrdersByCustomer.length,
		recurringCustomersCount: paidOrdersByCustomer.filter((row) => row._count._all > 1).length,
		neverSoldProductsCount,
		averageReviewRating: reviewAggregate._avg.rating ?? 0,
		reviewsCount: reviewAggregate._count,
		newReviewsCount,
		soonExpiringPromoCodesCount,
		giftCardOutstandingBalance: giftCardOutstandingAggregate._sum.balance ?? 0,
		loyaltyAwardsCount,
		newContactSubmissionsCount
	};
}
