// Configuration partagée des scripts k6, uniquement des variables d'env avec
// des valeurs par défaut cohérentes avec le seed de perf (`prisma/seed-perf.js`)
// et le seed de démo (`prisma/seed.js`) — pas de secret en dur au-delà des
// mots de passe de démo déjà publics dans ces seeds.

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:2000';

// Doit correspondre à PERF_USERS utilisé lors du `npm run seed:perf` (défaut
// commun aux deux côtés : 3000). Les comptes générés sont
// `perf-user-{0..N-1}@perf.test`.
export const PERF_USER_COUNT = Number(__ENV.PERF_USER_COUNT || 3000);
export const PERF_PASSWORD = __ENV.PERF_PASSWORD || 'PerfSeed!2026';

// Compte admin de démonstration (`prisma/seed.js`), à ne jamais utiliser
// contre un environnement autre que local/staging jetable.
export const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@madeindiamonds.com';
export const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'DemoPass!2026';
