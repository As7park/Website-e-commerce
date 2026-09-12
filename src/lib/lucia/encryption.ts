// -----------------------------------------------------------------------------
// Chiffrement symétrique des secrets 2FA (clé TOTP, code de récupération).
//
// AES-256-GCM (`ENCRYPTION_KEY`, 32 octets) pour tout chiffrement neuf. Une
// clé legacy AES-128-GCM (`ENCRYPTION_KEY_LEGACY`, 16 octets) reste lisible
// pour les secrets chiffrés avant la migration — voir `encryptionVersion` sur
// `User` : 1 = legacy AES-128, 2 = AES-256. Chaque authentification réussie
// qui déchiffre un secret encore en v1 le ré-encode en v2 (comme un rehash de
// mot de passe au login), pas de migration en masse à exécuter.
//
// Le vecteur d'initialisation est tiré au hasard à chaque appel et stocké en
// tête du chiffré, suivi du tag d'authentification : [iv 16 | chiffré | tag 16].
//
// Ces secrets ne peuvent pas être hachés comme un mot de passe : le serveur doit
// pouvoir les relire pour valider un code. Perdre une des deux clés rend donc
// inutilisables toutes les 2FA chiffrées avec elle — à sauvegarder au même
// titre qu'un mot de passe de base de données.
// -----------------------------------------------------------------------------

import { decodeBase64 } from '@oslojs/encoding';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ENCRYPTION_KEY, ENCRYPTION_KEY_LEGACY } from '$env/static/private';

export type EncryptionVersion = 1 | 2;

if (!ENCRYPTION_KEY) {
	throw new Error(
		'ENCRYPTION_KEY is not defined in environment variables. Please check your .env file.'
	);
}

const key = decodeBase64(ENCRYPTION_KEY);
// Optionnelle uniquement une fois qu'il ne reste plus aucune ligne en
// `encryptionVersion = 1` en base — sinon requise pour déchiffrer les
// secrets pas encore migrés.
const legacyKey = ENCRYPTION_KEY_LEGACY ? decodeBase64(ENCRYPTION_KEY_LEGACY) : null;

function keyAndAlgorithmFor(version: EncryptionVersion) {
	if (version === 1) {
		if (!legacyKey) {
			throw new Error(
				'ENCRYPTION_KEY_LEGACY is not defined : impossible de déchiffrer un secret en encryptionVersion=1.'
			);
		}
		return { algorithm: 'aes-128-gcm' as const, key: legacyKey };
	}
	return { algorithm: 'aes-256-gcm' as const, key };
}

// Fonction utilitaire pour valider une chaîne Base64
function isValidBase64(str: string): boolean {
	return /^[A-Za-z0-9+/]+={0,2}$/.test(str);
}

/** Chiffre en AES-256-GCM (`encryptionVersion` 2 — tout chiffrement neuf). */
export function encrypt(data: Uint8Array): Uint8Array {
	const iv = randomBytes(16);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
	const tag = cipher.getAuthTag();

	return Buffer.concat([iv, ciphertext, tag]);
}

/** Chiffre une chaîne de caractères en AES-256-GCM. */
export function encryptString(data: string): Uint8Array {
	return encrypt(Buffer.from(data, 'utf-8'));
}

/**
 * Déchiffre un secret selon sa version (`User.encryptionVersion`) : 1 pour
 * l'ancienne clé AES-128-GCM, 2 (défaut) pour la nouvelle AES-256-GCM.
 */
export function decrypt(
	encrypted: string | Uint8Array,
	version: EncryptionVersion = 2
): Uint8Array {
	if (typeof encrypted === 'string') {
		if (!isValidBase64(encrypted)) {
			throw new Error('Invalid Base64 string');
		}

		try {
			encrypted = decodeBase64(encrypted);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Erreur lors du décodage Base64 : ${errorMessage}`);
		}
	}

	if (encrypted.byteLength < 32) {
		throw new Error('Invalid data: Insufficient length');
	}

	const iv = encrypted.slice(0, 16);
	const tag = encrypted.slice(encrypted.byteLength - 16);
	const ciphertext = encrypted.slice(16, encrypted.byteLength - 16);

	const { algorithm, key: decryptionKey } = keyAndAlgorithmFor(version);
	const decipher = createDecipheriv(algorithm, decryptionKey, iv);

	if (tag.byteLength !== 16) {
		throw new Error(`Invalid Auth Tag length: ${tag.byteLength}`);
	}

	decipher.setAuthTag(tag);

	try {
		return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		throw new Error(`Erreur lors du déchiffrement : ${errorMessage}`);
	}
}

/** Déchiffre et retourne le résultat sous forme de chaîne de caractères. */
export function decryptToString(data: Uint8Array, version: EncryptionVersion = 2): string {
	return Buffer.from(decrypt(data, version)).toString('utf-8');
}
