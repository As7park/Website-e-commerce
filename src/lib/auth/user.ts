/**
 * Forme de `event.locals.user` — même champs qu'avant la migration
 * (`$lib/lucia/user.ts`), sauf `totpKey` (le secret TOTP ne quitte plus
 * jamais la table `TwoFactor` de Better Auth, aucun code applicatif n'a
 * plus besoin de le lire). Voir MIGRATION_BETTER_AUTH.md.
 */
export type User = {
	id: string;
	email: string;
	username: string | null;
	emailVerified: boolean;
	/** Une clé TOTP est enregistrée : la 2FA est configurée (pas seulement exigée). */
	registered2FA: boolean;
	googleId: string | null;
	name: string | null;
	picture: string | null;
	role: string;
	/** La 2FA est exigée sur ce compte (distinct de « configurée » ci-dessus). */
	isMfaEnabled: boolean;
};

/** Projette l'utilisateur renvoyé par `auth.api.getSession` vers notre forme stable. */
export function toLocalsUser(betterAuthUser: {
	id: string;
	email: string;
	username?: string | null;
	emailVerified: boolean;
	twoFactorEnabled?: boolean | null;
	googleId?: string | null;
	name?: string | null;
	picture?: string | null;
	role?: string | null;
	isMfaEnabled?: boolean | null;
}): User {
	return {
		id: betterAuthUser.id,
		email: betterAuthUser.email,
		username: betterAuthUser.username ?? null,
		emailVerified: betterAuthUser.emailVerified,
		registered2FA: betterAuthUser.twoFactorEnabled ?? false,
		googleId: betterAuthUser.googleId ?? null,
		name: betterAuthUser.name ?? null,
		picture: betterAuthUser.picture ?? null,
		role: betterAuthUser.role ?? 'CLIENT',
		isMfaEnabled: betterAuthUser.isMfaEnabled ?? false
	};
}
