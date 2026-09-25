/**
 * Identité de l'entreprise (`/admin/settings`) — tous les champs sont
 * optionnels (un champ vide reste `[À COMPLÉTER]` sur les mentions légales,
 * ou retombe sur les valeurs de repli des factures) mais chacun, une fois
 * rempli, doit être un texte non vide.
 */
import { z } from 'zod';

const optionalText = z.string().trim().max(200).optional().or(z.literal(''));

export const companyIdentitySchema = z.object({
	name: optionalText,
	legalForm: optionalText,
	shareCapital: optionalText,
	address: optionalText,
	city: optionalText,
	siret: optionalText,
	vatNumber: optionalText,
	publicationDirector: optionalText,
	phone: optionalText,
	email: z.string().trim().email("Format d'e-mail invalide").max(200).optional().or(z.literal(''))
});
