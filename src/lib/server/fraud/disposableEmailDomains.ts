/**
 * Domaines d'e-mail jetable connus — liste statique de départ, à enrichir
 * manuellement dans le temps (pas de service tiers consulté ici). Utilisée
 * uniquement par `computeFraudScore` (`$lib/server/fraud.ts`) comme l'un des
 * trois facteurs de risque, jamais pour bloquer une inscription/adresse en
 * dehors de ce contexte.
 */
export const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
	'mailinator.com',
	'guerrillamail.com',
	'guerrillamail.info',
	'10minutemail.com',
	'10minutemail.net',
	'yopmail.com',
	'yopmail.fr',
	'trashmail.com',
	'trashmail.net',
	'throwawaymail.com',
	'sharklasers.com',
	'dispostable.com',
	'getnada.com',
	'tempmail.com',
	'temp-mail.org',
	'fakeinbox.com',
	'maildrop.cc',
	'mintemail.com',
	'mytemp.email',
	'moakt.com',
	'discard.email',
	'spamgourmet.com',
	'mailnesia.com',
	'mailcatch.com',
	'tempinbox.com',
	'emailondeck.com',
	'crazymailing.com',
	'burnermail.io',
	'mail-temporaire.fr',
	'jetable.org'
]);

export function isDisposableEmailDomain(email: string): boolean {
	const domain = email.split('@')[1]?.trim().toLowerCase();
	if (!domain) return false;
	return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}
