/**
 * Vérification directe de la 2FA (`TwoFactor.secret`/`.backupCodes`), pour les
 * deux seuls parcours qui n'ont pas de session Better Auth active au moment
 * du contrôle et ne peuvent donc pas passer par `auth.api.verifyTOTP`/
 * `verifyBackupCode` :
 *
 *   - `/auth/reset-password/2fa` : la session de réinitialisation
 *     (`PasswordResetSession`) n'est pas une session Better Auth ;
 *   - `/auth/2fa/reset` (login normal, code de secours) : décide aussi s'il
 *     faut retirer la 2FA, ce que Better Auth ne fait jamais de lui-même à
 *     la vérification d'un code de secours.
 *
 * Partout où une session Better Auth existe déjà (`/auth/2fa`,
 * `/auth/2fa/setup`), on appelle directement `auth.api.verifyTOTP`/
 * `verifyBackupCode` — jamais ce module, qui dupliquerait sa logique.
 *
 * Exception : `enableTwoFactorDirect` ci-dessous. `auth.api.enableTwoFactor`
 * exige le mot de passe actuel dès que le compte en a un
 * (`shouldRequirePassword` ignore `allowPasswordless` dans ce cas précis —
 * cette option ne dispense que les comptes SANS mot de passe local, voir
 * `node_modules/better-auth/dist/utils/password.mjs`), ce qui aurait changé
 * l'UX existante (jamais de mot de passe demandé pour armer/retirer la 2FA,
 * voir MIGRATION_BETTER_AUTH.md §14). On écrit donc la ligne `TwoFactor`
 * nous-mêmes, avec le même chiffrement (`better-auth/crypto`) — Better Auth
 * la relit ensuite normalement (`auth.api.verifyTOTP`), aucune différence
 * pour lui entre une ligne qu'il a créée et une ligne créée ici.
 */
import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto';
import { verifyTOTP } from '@oslojs/otp';
import { encodeBase32NoPadding } from '@oslojs/encoding';
import { prisma } from '$lib/server';
import { BETTER_AUTH_SECRET } from '$env/static/private';

const TOTP_ISSUER = 'MadeInDiamonds';
/** Même valeur que `backupCodeOptions.amount` dans `$lib/auth/index.ts`. */
const RECOVERY_CODE_LENGTH = 15;

function randomString(length: number): string {
	const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => charset[b % charset.length]).join('');
}

async function decryptTwoFactorSecret(encryptedSecret: string): Promise<Uint8Array> {
	const secret = await symmetricDecrypt({ key: BETTER_AUTH_SECRET, data: encryptedSecret });
	// Better Auth utilise la chaîne décryptée telle quelle comme clé HMAC
	// (encodage UTF-8), jamais un décodage base32 — voir
	// `@better-auth/utils/otp` et MIGRATION_BETTER_AUTH.md.
	return new TextEncoder().encode(secret);
}

async function decryptBackupCodes(encryptedBackupCodes: string): Promise<string[]> {
	const json = await symmetricDecrypt({ key: BETTER_AUTH_SECRET, data: encryptedBackupCodes });
	try {
		const codes = JSON.parse(json);
		return Array.isArray(codes) ? codes : [];
	} catch {
		return [];
	}
}

/** Code TOTP valide, vérifié hors de toute session Better Auth. */
export async function verifyTotpCodeDirect(userId: string, code: string): Promise<boolean> {
	const twoFactor = await prisma.twoFactor.findFirst({ where: { userId } });
	if (!twoFactor) return false;
	const key = await decryptTwoFactorSecret(twoFactor.secret);
	return verifyTOTP(key, 30, 6, code);
}

/**
 * Code de secours accepté : retire la 2FA du compte (clé TOTP et code de
 * secours supprimés) et renvoie `true`. Même sémantique que l'ancien
 * `resetUser2FAWithRecoveryCode` — un code de secours est une porte de
 * sortie complète, pas une simple authentification ponctuelle (Better Auth,
 * qui autorise plusieurs connexions avec des codes de secours différents,
 * n'a pas cette notion : `backupCodeOptions.amount` vaut `1` ici précisément
 * pour que ce comportement reste cohérent, voir `$lib/auth/index.ts`).
 */
export async function verifyAndConsumeRecoveryCodeDirect(
	userId: string,
	code: string
): Promise<boolean> {
	const twoFactor = await prisma.twoFactor.findFirst({ where: { userId } });
	if (!twoFactor) return false;
	const codes = await decryptBackupCodes(twoFactor.backupCodes);
	if (!codes.includes(code)) return false;

	await disableTwoFactor(userId);
	return true;
}

/**
 * Démarre la configuration TOTP sans mot de passe — voir le commentaire de
 * tête. Écrase toute configuration non encore validée (`verified: false`),
 * jamais une configuration déjà active (appelant déjà garanti par
 * `registered2FA` côté route).
 */
export async function enableTwoFactorDirect(
	userId: string,
	accountLabel: string
): Promise<{ totpURI: string; recoveryCode: string; encodedTOTPKey: string }> {
	const secret = randomString(32);
	const recoveryCode = randomString(RECOVERY_CODE_LENGTH);
	const formattedRecoveryCode = `${recoveryCode.slice(0, 5)}-${recoveryCode.slice(5)}`;

	const [encryptedSecret, encryptedBackupCodes] = await Promise.all([
		symmetricEncrypt({ key: BETTER_AUTH_SECRET, data: secret }),
		symmetricEncrypt({ key: BETTER_AUTH_SECRET, data: JSON.stringify([formattedRecoveryCode]) })
	]);

	// Pas de contrainte unique sur `userId` (voir `prisma/schema.prisma`,
	// même convention que Better Auth lui-même : un `findOne` applicatif,
	// jamais une contrainte DB) — `upsert` n'est donc pas utilisable ici.
	const existing = await prisma.twoFactor.findFirst({ where: { userId } });
	const data = { secret: encryptedSecret, backupCodes: encryptedBackupCodes, verified: false };
	if (existing) {
		await prisma.twoFactor.update({ where: { id: existing.id }, data });
	} else {
		await prisma.twoFactor.create({ data: { ...data, userId } });
	}

	const secretBytes = new TextEncoder().encode(secret);
	const secretBase32 = encodeBase32NoPadding(secretBytes);
	const totpURI =
		`otpauth://totp/${encodeURIComponent(TOTP_ISSUER)}:${encodeURIComponent(accountLabel)}` +
		`?secret=${secretBase32}&issuer=${encodeURIComponent(TOTP_ISSUER)}&digits=6&period=30`;

	return {
		totpURI,
		recoveryCode: formattedRecoveryCode,
		encodedTOTPKey: Buffer.from(secretBytes).toString('base64')
	};
}

/** Retire la 2FA d'un compte (clé TOTP + code de secours supprimés). */
export async function disableTwoFactor(userId: string): Promise<void> {
	await prisma.$transaction([
		prisma.twoFactor.deleteMany({ where: { userId } }),
		prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } })
	]);
}
