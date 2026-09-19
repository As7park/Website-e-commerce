// Vérifie combien de comptes restent chiffrés avec l'ancien schéma
// (`encryptionVersion = 1`, AES-128-GCM, clé `ENCRYPTION_KEY_LEGACY`).
//
// Utile avant de retirer `ENCRYPTION_KEY_LEGACY` de l'environnement (voir
// docs/secrets-rotation.md) : tant que ce compte n'est pas à 0, la clé legacy
// reste nécessaire — chaque compte bascule automatiquement en v2 à sa
// prochaine authentification 2FA réussie, pas de migration en masse à lancer.
//
// Usage : `npm run check:legacy-encryption`
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	const legacyCount = await prisma.user.count({ where: { encryptionVersion: 1 } });
	const totalWith2fa = await prisma.user.count({
		where: { OR: [{ totpKey: { not: null } }, { recoveryCode: { not: null } }] }
	});

	console.log(`Comptes en encryptionVersion=1 (AES-128 legacy) : ${legacyCount}`);
	console.log(`Comptes avec un secret 2FA (toutes versions)    : ${totalWith2fa}`);

	if (legacyCount === 0) {
		console.log("→ ENCRYPTION_KEY_LEGACY peut être retirée de l'environnement.");
	} else {
		console.log(
			`→ ENCRYPTION_KEY_LEGACY reste nécessaire (${legacyCount} compte(s) pas encore migré(s)).`
		);
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
