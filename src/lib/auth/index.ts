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
import { hashPassword, verifyPasswordHash } from '#lib/auth/password';
import { prisma } from '#lib/server';
import { resolveAppUrl } from '#lib/server/app-url';
import { generateUniqueReferralCode } from '#lib/prisma/referral/referral';
import { isDummySecret } from '#lib/server/dummy-secrets';
import { BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '$app/env/private';

export const auth = betterAuth({
	appName: 'MadeInDiamonds',
	secret: BETTER_AUTH_SECRET,
	// Résolu PAR REQUÊTE (hôte demandé, voir `allowedHosts`), jamais une
	// chaîne figée au démarrage : `svelteKitHandler` (`src/hooks.server.ts`)
	// compare l'origine de chaque requête à cette valeur pour décider si elle
	// relève de Better Auth (`/api/auth/**`) — une chaîne fixe calculée une
	// fois (ex. port 2000 par défaut de `resolveAppUrlOrDefault()`) ne
	// correspond jamais sur un autre port (dev alternatif, suite e2e sur
	// 2001, Preview Vercel), et Better Auth n'intercepte alors plus aucune
	// requête, en silence (404 côté SvelteKit). Voir MIGRATION_BETTER_AUTH.md.
	baseURL: {
		allowedHosts: [
			'localhost:*',
			'127.0.0.1:*',
			'madeindiamonds.com',
			'*.madeindiamonds.com',
			'*.vercel.app'
		],
		fallback: resolveAppUrl() ?? undefined
	},
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
			marketingEmailsOptIn: { type: 'boolean', input: false, defaultValue: false },
			// Resynchronisé par `databaseHooks.account.create.after` ci-dessous,
			// jamais fourni en entrée directement.
			googleId: { type: 'string', required: false, input: false },
			// La 2FA est EXIGÉE sur ce compte (distinct de `twoFactorEnabled`,
			// propre au plugin `twoFactor`, qui dit si elle est CONFIGURÉE) —
			// sans cette déclaration, Better Auth filtre silencieusement le
			// champ de toute réponse (`getSession`, etc.), et `toLocalsUser`
			// le voit toujours comme `false` quelle que soit sa valeur réelle.
			isMfaEnabled: { type: 'boolean', input: false, defaultValue: false }
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
		// mêmes seuils que `#lib/lucia/session.ts` avant migration.
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
			hash: hashPassword,
			verify: ({ hash: storedHash, password }) => verifyPasswordHash(storedHash, password)
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
			clientSecret: GOOGLE_CLIENT_SECRET,
			// `GOOGLE_CLIENT_ID` factice (e2e) : l'échange de code OAuth réel
			// (`https://oauth2.googleapis.com/token`) n'est jamais atteignable
			// dans ce cas, donc impossible à simuler via ce chemin. Les tests
			// passent plutôt par `auth.api.signInSocial({ idToken: ... })`
			// (voir `e2e/support/flows.ts`, `signInWithFakeGoogle`), qui ne
			// touche jamais le réseau Google si cette vérification est
			// permissive. N'existe que dans cette configuration : avec un
			// vrai `GOOGLE_CLIENT_ID`, Better Auth retombe sur sa vérification
			// cryptographique habituelle (JWKS Google), jamais contournée.
			...(isDummySecret(GOOGLE_CLIENT_ID) ? { verifyIdToken: async () => true } : {})
		}
	},

	plugins: [
		twoFactor({
			issuer: 'MadeInDiamonds',
			// Un seul code de secours, jamais régénérable sans reconfigurer la
			// 2FA — même sémantique que l'ancien `User.recoveryCode` (Lucia).
			// `length: 15` donne un code affiché de 16 caractères
			// (5 + tiret + 10), comme avant la migration.
			backupCodeOptions: { amount: 1, length: 15 },
			// Comme avant la migration : configurer/retirer la 2FA ne demande
			// jamais le mot de passe du compte.
			allowPasswordless: true
		}),
		adminPlugin({ adminRoles: ['ADMIN'], defaultRole: 'CLIENT' }),
		haveIBeenPwned()
	],

	databaseHooks: {
		account: {
			create: {
				/**
				 * `User.googleId` reste la source lue par ~6 fichiers existants
				 * (« ce compte a-t-il un mot de passe local ou vient-il
				 * uniquement de Google ? ») — Better Auth, lui, ne connaît que la
				 * ligne `AuthAccount` (`providerId: "google"`). On la
				 * resynchronise ici pour ne changer aucun de ces call sites.
				 */
				after: async (account) => {
					if (account.providerId === 'google') {
						await prisma.user.update({
							where: { id: account.userId },
							data: { googleId: account.accountId }
						});
					}
				}
			}
		},
		user: {
			create: {
				/**
				 * `referralCode` est une colonne requise (pas de défaut Prisma,
				 * générée via `generateUniqueReferralCode()`) — Better Auth ne
				 * fournit que les champs qu'on lui déclare, jamais une valeur
				 * métier comme celle-ci. `referredById` (le parrain) n'est PAS
				 * résolu ici : `ctx.query`/`ctx.body` ne sont pas fiables quand
				 * `auth.api.signUpEmail` est appelé directement depuis le serveur
				 * (pas via une vraie requête HTTP) — résolu explicitement dans
				 * l'action `/auth/signup`, juste après la création du compte.
				 */
				before: async (user) => {
					const referralCode = await generateUniqueReferralCode();
					return { data: { ...user, referralCode } };
				}
			}
		}
	},

	advanced: {
		database: { generateId: false }
	}
});
