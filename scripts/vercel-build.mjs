// Commande de build Vercel (voir `vercel.json` → `buildCommand`).
//
// 1. Affiche un diagnostic : environnement, branche, et présence (jamais la
//    valeur) des variables indispensables au build — pour qu'un échec dû à
//    une variable absente se lise directement dans le log.
// 2. `DIRECT_URL` (connexion sans pooler, exigée par `prisma migrate`) est
//    déduite de `DATABASE_URL` si elle manque : sur Neon, c'est la même URL
//    sans le suffixe `-pooler` de l'hôte.
// 3. Applique les migrations, puis lance `vite build`.
import { execSync } from 'node:child_process';

const REQUIRED = [
	'DATABASE_URL',
	'DIRECT_URL',
	'ENCRYPTION_KEY',
	'ENCRYPTION_KEY_LEGACY',
	'GOOGLE_CLIENT_ID',
	'SECRET_ADDRESS_SEARCH_MODE',
	'PUBLIC_TINYMCE_API_KEY'
];

const isSet = (name) => Boolean(process.env[name]?.trim());

console.log('── Diagnostic build ──────────────────────────────');
console.log(`Environnement Vercel : ${process.env.VERCEL_ENV ?? '(hors Vercel)'}`);
console.log(`Branche              : ${process.env.VERCEL_GIT_COMMIT_REF ?? '(inconnue)'}`);
for (const name of REQUIRED) {
	console.log(`${isSet(name) ? '✔' : '✘'} ${name}`);
}
console.log('──────────────────────────────────────────────────');

if (!isSet('DIRECT_URL') && isSet('DATABASE_URL')) {
	process.env.DIRECT_URL = process.env.DATABASE_URL.replace(/-pooler(?=\.)/, '');
	console.log('ℹ DIRECT_URL absente : déduite de DATABASE_URL (hôte sans « -pooler »).');
}

const missing = REQUIRED.filter((name) => !isSet(name));
if (missing.length > 0) {
	console.error(
		`✘ Variables manquantes pour l'environnement « ${process.env.VERCEL_ENV ?? 'local'} » : ${missing.join(', ')}\n` +
			'  → Vercel > Settings > Environment Variables : les déclarer pour cet environnement, puis Redeploy.'
	);
	process.exit(1);
}

const run = (command) => execSync(command, { stdio: 'inherit', env: process.env });
run('npx prisma migrate deploy');
run('npx vite build');
