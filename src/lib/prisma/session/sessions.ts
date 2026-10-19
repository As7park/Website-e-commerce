import { prisma } from '#lib/server';

/**
 * Appareil/localisation d'une session, sans le reste (jamais `user` — voir
 * `/auth/not-me/[token]`, une page publique qui ne doit exposer aucune
 * donnée de compte au-delà de « à quoi ressemblait la connexion »).
 */
export const findSessionDeviceInfo = async (sessionId: string) => {
	return await prisma.authSession.findUnique({
		where: { id: sessionId },
		select: { userAgent: true, city: true, country: true }
	});
};

/** Sessions d'un compte, les plus récemment actives d'abord — voir /auth/settings/sessions. */
export const findSessionsForUser = async (userId: string) => {
	return await prisma.authSession.findMany({
		where: { userId },
		orderBy: { lastActiveAt: 'desc' }
	});
};

/**
 * Supprime une session précise, mais seulement si elle appartient bien à
 * `userId` — `id`+`userId` dans le même `where` rend la vérification de
 * propriété atomique avec la suppression (pas de fenêtre entre un contrôle
 * séparé et l'action, pas d'IDOR possible en devinant l'id d'une session).
 * Renvoie `count: 0` si la session n'existe pas ou appartient à quelqu'un
 * d'autre — l'appelant ne doit jamais distinguer les deux (pas d'oracle).
 */
export const deleteSessionForUser = async (userId: string, sessionId: string) => {
	return await prisma.authSession.deleteMany({
		where: { id: sessionId, userId }
	});
};

/** Toutes les sessions d'un compte sauf celle en cours — bouton « déconnecter les autres ». */
export const deleteOtherSessionsForUser = async (userId: string, currentSessionId: string) => {
	return await prisma.authSession.deleteMany({
		where: { userId, id: { not: currentSessionId } }
	});
};

/**
 * Marque une session comme active à l'instant présent — appelée depuis
 * `#lib/auth/hooks.ts`, jamais bloquante pour la requête (best-effort).
 * Déjà bornée à ~1 écriture toutes les 8s par visiteur par le cache
 * d'identité Redis (`SESSION_IDENTITY_CACHE_TTL_SECONDS`) : pas besoin d'un
 * seuil de fraîcheur supplémentaire ici.
 */
export const touchSessionActivity = async (sessionId: string) => {
	return await prisma.authSession.update({
		where: { id: sessionId },
		data: { lastActiveAt: new Date() }
	});
};
