// -----------------------------------------------------------------------------
// Crée UN compte ADMIN, sans toucher au reste de la base (contrairement au seed,
// qui vide toutes les tables).
//
//   node scripts/create-admin.mjs <email> [nom affiché]
//
// Le mot de passe est généré aléatoirement et affiché une seule fois ; on peut
// imposer le sien via ADMIN_PASSWORD. Refuse si l'email existe déjà : pour un
// compte existant, changer le rôle depuis /admin/users/[id].
// -----------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { createCipheriv, randomBytes, randomInt } from 'crypto';
import { decodeBase64, encodeBase32UpperCaseNoPadding } from '@oslojs/encoding';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.ENCRYPTION_KEY) {
	throw new Error('ENCRYPTION_KEY is not defined in the environment variables.');
}

const [email, name = 'Administrateur'] = process.argv.slice(2);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
	console.error('Usage : node scripts/create-admin.mjs <email> [nom affiché]');
	process.exit(1);
}

const key = decodeBase64(process.env.ENCRYPTION_KEY);
const prisma = new PrismaClient();

// Mêmes paramètres que le seed et l'inscription.
const ARGON2 = {
	memoryCost: 19456,
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
};

// AES-256-GCM (`encryptionVersion` 2) — même schéma que `$lib/lucia/encryption.ts`.
const encrypt = (data) => {
	const iv = randomBytes(16);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, ciphertext, tag]);
};

// Respecte `signupSchema` : majuscule, minuscule, chiffre, caractère spécial.
const generatePassword = () => {
	const classes = [
		'ABCDEFGHJKLMNPQRSTUVWXYZ',
		'abcdefghijkmnopqrstuvwxyz',
		'23456789',
		'!@#$%&*?-'
	];
	const all = classes.join('');
	const chars = classes.map((set) => set[randomInt(set.length)]);
	while (chars.length < 16) chars.push(all[randomInt(all.length)]);
	for (let i = chars.length - 1; i > 0; i--) {
		const j = randomInt(i + 1);
		[chars[i], chars[j]] = [chars[j], chars[i]];
	}
	return chars.join('');
};

// Même alphabet que `generateUniqueReferralCode` côté app.
const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateReferralCode = () =>
	Array.from(
		{ length: 8 },
		() => REFERRAL_CODE_ALPHABET[randomInt(REFERRAL_CODE_ALPHABET.length)]
	).join('');

async function main() {
	if (await prisma.user.findUnique({ where: { email } })) {
		console.error(`Un compte ${email} existe déjà : change son rôle depuis /admin/users.`);
		process.exitCode = 1;
		return;
	}

	const password = process.env.ADMIN_PASSWORD || generatePassword();
	const recoveryCode = encodeBase32UpperCaseNoPadding(randomBytes(10));

	let referralCode = generateReferralCode();
	while (await prisma.user.findUnique({ where: { referralCode } })) {
		referralCode = generateReferralCode();
	}

	await prisma.user.create({
		data: {
			email,
			username: name,
			name,
			role: 'ADMIN',
			emailVerified: true,
			passwordHash: await hash(password, ARGON2),
			recoveryCode: encrypt(Buffer.from(recoveryCode, 'utf-8')).toString('base64'),
			encryptionVersion: 2,
			referralCode
		}
	});

	console.log('\nCompte ADMIN créé :');
	console.log(`  Identifiant  : ${email}`);
	console.log(`  Mot de passe : ${password}`);
	console.log('\nNote-le maintenant, il ne sera plus affiché.');
}

main()
	.catch((error) => {
		console.error('Échec de la création du compte :', error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
