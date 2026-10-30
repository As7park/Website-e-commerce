/**
 * Nom du cookie éphémère qui porte le code de secours de
 * `/auth/2fa/setup` (où il est posé) jusqu'à `/auth/recovery-code` (où il
 * est lu puis effacé) — voir le commentaire de tête de ces deux fichiers.
 */
export const RECOVERY_CODE_COOKIE = 'pending_recovery_code';
