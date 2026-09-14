import { prisma } from '$lib/server';

/**
 * Purge périodique des lignes qui n'ont plus de valeur passé leur expiration.
 *
 * Ce qui est purgé (aucune obligation de conservation) :
 * - `sessions`, `email_verification_requests`, `password_reset_sessions`
 *   expirées : jusqu'ici supprimées seulement au coup par coup, à la prochaine
 *   lecture du même token (`validateSessionToken`, etc.) — une session jamais
 *   revisitée restait en base indéfiniment.
 * - `orders` PENDING abandonnées depuis plus de `ABANDONED_ORDER_DAYS` : un
 *   panier jamais payé (`OrderItem`/`Custom` cascadent avec l'`Order`). Le
 *   filtre porte sur `updatedAt`, pas `createdAt` : un panier alimenté
 *   progressivement sur plusieurs mois reste `updatedAt` récent et ne doit
 *   jamais être purgé, même s'il a été créé il y a longtemps.
 *
 * Ce qui n'est JAMAIS purgé : `transactions` (écriture comptable permanente,
 * voir `docs/commerce/README.md`) ni les `orders` déjà `PAID`/`SHIPPED`.
 *
 * Chaque exécution est journalisée (comptes + durée), succès ou échec : cette
 * route n'a pas d'autre lecteur que les logs (le cron ne relit jamais la
 * réponse HTTP), donc c'est la seule trace exploitable en cas d'incident.
 */

const ABANDONED_ORDER_DAYS = 30;

export interface CleanupResult {
	expiredSessions: number;
	expiredEmailVerificationRequests: number;
	expiredPasswordResetSessions: number;
	abandonedPendingOrders: number;
	durationMs: number;
}

export async function runCleanupJob(): Promise<CleanupResult> {
	const startedAt = Date.now();
	const now = new Date();
	const abandonedBefore = new Date(now.getTime() - ABANDONED_ORDER_DAYS * 24 * 60 * 60 * 1000);

	try {
		const [expiredSessions, expiredEmailVerificationRequests, expiredPasswordResetSessions] =
			await Promise.all([
				prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
				prisma.emailVerificationRequest.deleteMany({ where: { expiresAt: { lt: now } } }),
				prisma.passwordResetSession.deleteMany({ where: { expiresAt: { lt: now } } })
			]);

		// Séparé du `Promise.all` ci-dessus : cible `orders`/`order_items`, pas les
		// tables d'auth, pas de raison de les faire échouer ensemble.
		const abandonedPendingOrders = await prisma.order.deleteMany({
			where: { status: 'PENDING', updatedAt: { lt: abandonedBefore } }
		});

		const result: CleanupResult = {
			expiredSessions: expiredSessions.count,
			expiredEmailVerificationRequests: expiredEmailVerificationRequests.count,
			expiredPasswordResetSessions: expiredPasswordResetSessions.count,
			abandonedPendingOrders: abandonedPendingOrders.count,
			durationMs: Date.now() - startedAt
		};

		console.log('[cleanup] purge terminée', result);
		return result;
	} catch (error) {
		console.error('[cleanup] échec de la purge', {
			durationMs: Date.now() - startedAt,
			error
		});
		throw error;
	}
}
