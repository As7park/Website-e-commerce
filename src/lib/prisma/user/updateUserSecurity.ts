import { prisma } from '$lib/server';
import { hashPassword } from '$lib/auth/password';

/**
 * Met à jour les paramètres de sécurité d'un compte depuis l'administration.
 *
 * `passwordHash` reçoit un mot de passe en clair, haché ici avant écriture
 * dans `AuthAccount` (`providerId: "credential"`, voir
 * MIGRATION_BETTER_AUTH.md) — jamais dans `User`, qui ne porte plus de mot de
 * passe. La robustesse n'est PAS vérifiée à ce niveau : c'est un acte
 * d'administration, pas un changement de mot de passe par l'utilisateur (voir
 * `/auth/settings`, qui passe par `auth.api.changePassword`).
 */
export const updateUserSecurity = async (
	id: string,
	{ isMfaEnabled, passwordHash }: { isMfaEnabled: boolean; passwordHash?: string | null }
) => {
	try {
		await prisma.user.update({ where: { id }, data: { isMfaEnabled } });

		if (passwordHash) {
			const hashed = await hashPassword(passwordHash);
			await prisma.authAccount.upsert({
				where: { providerId_accountId: { providerId: 'credential', accountId: id } },
				update: { password: hashed },
				create: { userId: id, providerId: 'credential', accountId: id, password: hashed }
			});
		}
	} catch (error) {
		console.error('Error updating user security:', error);
		throw error;
	}
};
