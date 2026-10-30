// -----------------------------------------------------------------------------
// Génération des codes de vérification par email, lisibles par un humain.
//
// Base32 sans rembourrage : uniquement des majuscules et des chiffres, faciles
// à recopier depuis un email. 5 octets aléatoires donnent 8 caractères.
// -----------------------------------------------------------------------------

import { encodeBase32UpperCaseNoPadding } from '@oslojs/encoding';

export function generateRandomOTP(): string {
	const bytes = new Uint8Array(5);
	crypto.getRandomValues(bytes);
	const code = encodeBase32UpperCaseNoPadding(bytes);
	return code;
}
