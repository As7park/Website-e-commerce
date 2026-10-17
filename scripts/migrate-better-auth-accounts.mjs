#!/usr/bin/env node
/**
 * Migration de données Lucia → Better Auth (voir MIGRATION_BETTER_AUTH.md).
 *
 * Copie chaque `User.passwordHash`/`User.googleId` existant vers une ligne
 * `AuthAccount` (`credential`/`google`) — aucun mot de passe réinitialisé,
 * aucun compte Google à relier à nouveau. Le hash Argon2id n'est jamais
 * recalculé : `src/lib/auth/index.ts` utilise exactement les mêmes
 * paramètres, donc le hash existant reste vérifiable tel quel.
 *
 * Volontairement HORS PÉRIMÈTRE : `totpKey`/`recoveryCode` (2FA) — chiffrés
 * avec notre propre AES-256-GCM, format non reproductible dans le stockage
 * interne (non documenté) du plugin `twoFactor` de Better Auth. Les comptes
 * avec la 2FA active devront la reconfigurer une fois (voir doc de
 * déploiement) — décision actée, pas un oubli.
 *
 * Idempotent : peut être rejoué sans effet (upsert sur la contrainte unique
 * `(providerId, accountId)`).
 *
 *   node scripts/migrate-better-auth-accounts.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	const users = await prisma.user.findMany({
		where: { OR: [{ passwordHash: { not: null } }, { googleId: { not: null } }] },
		select: { id: true, passwordHash: true, googleId: true }
	});

	let credentialCount = 0;
	let googleCount = 0;

	for (const user of users) {
		if (user.passwordHash) {
			await prisma.authAccount.upsert({
				where: { providerId_accountId: { providerId: 'credential', accountId: user.id } },
				create: {
					providerId: 'credential',
					accountId: user.id,
					userId: user.id,
					password: user.passwordHash
				},
				update: { password: user.passwordHash }
			});
			credentialCount++;
		}

		if (user.googleId) {
			await prisma.authAccount.upsert({
				where: { providerId_accountId: { providerId: 'google', accountId: user.googleId } },
				create: {
					providerId: 'google',
					accountId: user.googleId,
					userId: user.id
				},
				update: {}
			});
			googleCount++;
		}
	}

	console.log(
		`Migré : ${credentialCount} compte(s) credential, ${googleCount} compte(s) google (${users.length} utilisateur(s) examiné(s)).`
	);
}

main()
	.catch((error) => {
		console.error('Échec de la migration :', error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
