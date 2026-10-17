/**
 * Hachage des mots de passe — paramètres partagés entre la config Better Auth
 * (`$lib/auth/index.ts`) et les quelques flux qui écrivent directement dans
 * `AuthAccount` sans passer par `auth.api` (réinitialisation par email,
 * administration : aucune session active à ce stade pour appeler
 * `auth.api.changePassword`/`setPassword`).
 *
 * Mêmes paramètres que l'ancien `$lib/lucia/password.ts` : aucun hash
 * existant n'a à être recalculé par cette migration.
 */
import { hash, verify } from '@node-rs/argon2';
import { sha1 } from '@oslojs/crypto/sha1';
import { encodeHexLowerCase } from '@oslojs/encoding';
import { prisma } from '$lib/server';

const ARGON2_OPTIONS = {
	memoryCost: 19456,
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
} as const;

export function hashPassword(password: string): Promise<string> {
	return hash(password, ARGON2_OPTIONS);
}

export function verifyPasswordHash(hash: string, password: string): Promise<boolean> {
	return verify(hash, password);
}

/**
 * Longueur puis base « Have I Been Pwned », interrogée en k-anonymat.
 *
 * Un incident réseau/DNS sur ce service tiers ne doit jamais bloquer une
 * inscription ou un changement de mot de passe légitime : la robustesse
 * reste vérifiée (longueur), seul le contrôle « déjà fuité » est ignoré
 * dans ce cas précis — mieux qu'un 500 sur un acte par ailleurs valide.
 */
export async function verifyPasswordStrength(password: string): Promise<boolean> {
	if (password.length < 8 || password.length > 255) {
		return false;
	}
	const digest = encodeHexLowerCase(sha1(new TextEncoder().encode(password)));
	const hashPrefix = digest.slice(0, 5);
	try {
		const response = await fetch(`https://api.pwnedpasswords.com/range/${hashPrefix}`, {
			signal: AbortSignal.timeout(5000)
		});
		const data = await response.text();
		const items = data.split('\n');
		for (const item of items) {
			const hashSuffix = item.slice(0, 35).toLowerCase();
			if (digest === hashPrefix + hashSuffix) {
				return false;
			}
		}
		return true;
	} catch (error) {
		console.error('Have I Been Pwned injoignable, contrôle ignoré :', error);
		return true;
	}
}

/** Hash du mot de passe local du compte (`AuthAccount`, `providerId: "credential"`), ou `null` (compte Google uniquement). */
export async function getCredentialPasswordHash(userId: string): Promise<string | null> {
	const account = await prisma.authAccount.findUnique({
		where: { providerId_accountId: { providerId: 'credential', accountId: userId } },
		select: { password: true }
	});
	return account?.password ?? null;
}
