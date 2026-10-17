/**
 * Instance Better Auth — remplace Lucia (voir MIGRATION_BETTER_AUTH.md).
 *
 * `user` réutilise la table `User` existante (partagée avec le commerce,
 * jamais dupliquée) ; `session`/`account`/`verification`/`twoFactor` sont de
 * nouvelles tables. Le hash de mot de passe reprend exactement les mêmes
 * paramètres Argon2id qu'avant la migration, pour qu'aucun compte existant
 * n'ait à réinitialiser son mot de passe (voir script de migration de données).
 */
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin as adminPlugin } from 'better-auth/plugins/admin';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { haveIBeenPwned } from 'better-auth/plugins/haveibeenpwned';
import { hash, verify } from '@node-rs/argon2';
import { prisma } from '$lib/server';
import { resolveAppUrlOrDefault } from '$lib/server/app-url';
import { generateUniqueReferralCode, getUserByReferralCode } from '$lib/prisma/referral/referral';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';
import { BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '$env/static/private';

/** Mêmes paramètres que `$lib/lucia/password.ts` (à retirer en Phase 4). */
const ARGON2_OPTIONS = {
	memoryCost: 19456,
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
} as const;

export const auth = betterAuth({
	appName: 'MadeInDiamonds',
	secret: BETTER_AUTH_SECRET,
	baseURL: resolveAppUrlOrDefault(),
	database: prismaAdapter(prisma, { provider: 'postgresql' }),

	user: {
		modelName: 'User',
		fields: {
			name: 'name',
			image: 'picture'
		},
		additionalFields: {
			role: { type: 'string', input: false, defaultValue: 'CLIENT' },
			username: { type: 'string', required: false },
			referralCode: { type: 'string', input: false },
			referredById: { type: 'string', required: false, input: false },
			marketingEmailsOptIn: { type: 'boolean', input: false, defaultValue: false }
		}
	},
	session: {
		modelName: 'AuthSession',
		additionalFields: {
			city: { type: 'string', required: false, input: false },
			country: { type: 'string', required: false, input: false },
			lastActiveAt: { type: 'date', input: false }
		},
		// 30 jours glissants, renouvelée dès qu'il reste moins de 15 jours —
		// mêmes seuils que `$lib/lucia/session.ts` avant migration.
		expiresIn: 60 * 60 * 24 * 30,
		updateAge: 60 * 60 * 24 * 15
	},
	account: { modelName: 'AuthAccount' },
	verification: { modelName: 'AuthVerification' },

	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		maxPasswordLength: 255,
		password: {
			hash: (password) => hash(password, ARGON2_OPTIONS),
			verify: ({ hash: storedHash, password }) => verify(storedHash, password)
		},
		// Comme avant la migration : l'inscription connecte immédiatement
		// (session créée avant même la vérification d'email) — c'est
		// `EmailVerificationRequest`/nos propres gardes de page qui limitent
		// ce que peut faire ce compte tant qu'il n'est pas vérifié, jamais le
		// flux intégré de reset de mot de passe de Better Auth (resté 100 %
		// maison, voir /auth/forgot-password et suite).
		autoSignIn: true
	},

	socialProviders: {
		google: {
			clientId: GOOGLE_CLIENT_ID,
			clientSecret: GOOGLE_CLIENT_SECRET
		}
	},

	plugins: [
		twoFactor({ issuer: 'MadeInDiamonds' }),
		adminPlugin({ adminRoles: ['ADMIN'], defaultRole: 'CLIENT' }),
		haveIBeenPwned()
	],

	databaseHooks: {
		user: {
			create: {
				/**
				 * `referralCode` est une colonne requise (pas de défaut Prisma,
				 * générée via `generateUniqueReferralCode()`) — Better Auth ne
				 * fournit que les champs qu'on lui déclare, jamais une valeur
				 * métier comme celle-ci. `referredById` reprend le même principe
				 * que l'ancien `createUser()` Lucia : résolu depuis `?ref=<code>`
				 * (lu ici dans `ctx.query`, posé par la page `/auth/signup`),
				 * jamais bloquant si le code est invalide ou le module désactivé.
				 */
				before: async (user, ctx) => {
					const referralCode = await generateUniqueReferralCode();

					let referredById: string | null = null;
					const refParam = ctx?.query?.ref;
					if (typeof refParam === 'string') {
						const { referralEnabled } = await getStoreFeatureFlags();
						if (referralEnabled) {
							const referrer = await getUserByReferralCode(refParam);
							referredById = referrer?.id ?? null;
						}
					}

					return { data: { ...user, referralCode, referredById } };
				}
			}
		}
	},

	advanced: {
		database: { generateId: false }
	}
});
