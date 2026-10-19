/**
 * Forme de `event.locals.session` — voir MIGRATION_BETTER_AUTH.md.
 *
 * `twoFactorVerified` disparaît : dans le modèle Better Auth, une session
 * n'existe QUE si le second facteur (quand exigé) a déjà été validé — il n'y
 * a plus d'état intermédiaire « session ouverte mais 2FA en attente »
 * (`/auth/login` ne crée la session qu'après succès de `/auth/2fa`, jamais
 * avant). `oauthProvider` disparaît aussi : l'origine de la connexion vit
 * désormais dans `AuthAccount.providerId`, pas sur la session elle-même —
 * aucun consommateur ne le lisait en dehors de l'affichage « appareil », déjà
 * couvert par `userAgent`.
 */
import { createHash } from 'node:crypto';
import { prisma } from '#lib/server';
import { invalidateCache } from '#lib/server/cache';

export type Session = {
	id: string;
	userId: string;
	expiresAt: Date;
};

/**
 * Révoque toutes les sessions d'un compte — changement de mot de passe,
 * suppression/anonymisation RGPD, action admin. Les tokens sont lus avant
 * suppression pour invalider leur entrée du cache d'identité (voir
 * `sessionIdentityCacheKey`), sans quoi une session tout juste supprimée
 * resterait valide jusqu'à `SESSION_IDENTITY_CACHE_TTL_SECONDS` de plus.
 */
export async function invalidateUserSessions(userId: string): Promise<void> {
	const sessions = await prisma.authSession.findMany({
		where: { userId },
		select: { token: true }
	});
	await prisma.authSession.deleteMany({ where: { userId } });
	await Promise.all(sessions.map((s) => invalidateCache(sessionIdentityCacheKey(s.token))));
}

/**
 * Clé du cache court d'identité résolue par requête (`#lib/auth/hooks.ts`),
 * keyée sur le `token` du cookie (le secret), jamais sur `AuthSession.id`
 * (un simple id de ligne, distinct du token sous Better Auth — voir
 * MIGRATION_BETTER_AUTH.md). Toute action qui révoque une session doit
 * invalider cette clé avec le `token` de la ligne supprimée, pas son `id`.
 */
export function sessionIdentityCacheKey(token: string): string {
	return `session-identity:${token}`;
}

/**
 * Révoque une session précise par son id de ligne — lien « Ce n'était pas
 * moi » (`/auth/not-me/[token]`), action admin. Idempotent : une session déjà
 * expirée/supprimée ne fait pas échouer l'appelant.
 */
export async function invalidateSession(sessionId: string): Promise<void> {
	let token: string | null = null;
	try {
		const deleted = await prisma.authSession.delete({ where: { id: sessionId } });
		token = deleted.token;
	} catch {
		return;
	}
	await invalidateCache(sessionIdentityCacheKey(token));
}

/**
 * Empreinte publique d'une session, à exposer à la place de son `id`
 * interne — même précaution que sous Lucia (où `Session.id` ÉTAIT le
 * token du cookie), gardée ici par défense en profondeur même si
 * `AuthSession.id` n'est plus lui-même le secret (voir `.token`).
 */
export function sessionPublicId(sessionId: string): string {
	return createHash('sha256').update(sessionId).digest('hex');
}

export function toLocalsSession(betterAuthSession: {
	id: string;
	userId: string;
	expiresAt: Date;
}): Session {
	return {
		id: betterAuthSession.id,
		userId: betterAuthSession.userId,
		expiresAt: betterAuthSession.expiresAt
	};
}
