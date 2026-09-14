/** PRODUCT-PLUGIN : schéma Zod du formulaire d'avis produit (public, authentifié). */
import { z } from 'zod';

export const reviewSchema = z.object({
	rating: z.coerce.number().int().min(1, 'Choisissez une note.').max(5, 'La note maximale est 5.'),
	comment: z
		.string()
		.trim()
		.max(1000, 'Le commentaire ne doit pas dépasser 1000 caractères.')
		.optional()
		.or(z.literal(''))
});
