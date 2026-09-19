/**
 * URL publique de l'application, pour les contextes serveur sans `RequestEvent`
 * (jobs, emails) qui doivent construire un lien absolu. `APP_URL` est explicite,
 * ou à défaut `VERCEL_URL` (fourni automatiquement par Vercel). `null` si
 * aucune des deux n'est définie (dev local) — à l'appelant de décider s'il lui
 * faut une valeur stricte (QStash, qui ne doit jamais rappeler `localhost`) ou
 * un repli de confort (lien dans un e-mail).
 */
export function resolveAppUrl(): string | null {
	if (process.env.APP_URL) {
		return process.env.APP_URL.replace(/\/$/, '');
	}
	if (process.env.VERCEL_URL) {
		return `https://${process.env.VERCEL_URL}`;
	}
	return null;
}
