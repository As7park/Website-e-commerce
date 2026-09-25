import type { PageServerLoad } from './$types';
import { getCompanyIdentity } from '$lib/server/companyIdentity';

/**
 * Mentions légales (LCEN art. 6-III-1) — identité de l'entreprise saisie
 * depuis `/admin/settings` (`$lib/server/companyIdentity.ts`). Chaque champ
 * non renseigné reste affiché comme « [À COMPLÉTER] » côté template, jamais
 * une valeur inventée à sa place.
 */
export const load = (async () => {
	const company = await getCompanyIdentity();
	return { company };
}) satisfies PageServerLoad;
