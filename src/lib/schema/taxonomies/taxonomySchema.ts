import { z } from 'zod';

const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const taxonomyTypeSchema = z.enum(['TEXT', 'COLOR', 'NUMBER', 'BOOLEAN', 'DATE']);

// Schéma pour la création d'une taxonomie
const createTaxonomySchema = z.object({
	name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
	slug: z
		.string()
		.min(2, 'Le slug doit contenir au moins 2 caractères')
		.regex(slugRegex, 'Le slug doit être en minuscules, sans espaces ni accents (ex: couleur)'),
	type: taxonomyTypeSchema,
	multiple: z.boolean().default(true),
	// Utilisés seulement si `type = NUMBER` — validés à la saisie d'une valeur.
	numberMin: z.coerce.number().optional(),
	numberMax: z.coerce.number().optional(),
	numberUnit: z.string().trim().max(16).optional().or(z.literal(''))
});

// Schéma pour la mise à jour d'une taxonomie
const updateTaxonomySchema = createTaxonomySchema.extend({
	id: z.string()
});

// Schéma pour la suppression d'une taxonomie
const deleteTaxonomySchema = z.object({
	id: z.string()
});

type CreateTaxonomy = z.infer<typeof createTaxonomySchema>;
type UpdateTaxonomy = z.infer<typeof updateTaxonomySchema>;
type DeleteTaxonomy = z.infer<typeof deleteTaxonomySchema>;

export { createTaxonomySchema, updateTaxonomySchema, deleteTaxonomySchema, taxonomyTypeSchema };
export type { CreateTaxonomy, UpdateTaxonomy, DeleteTaxonomy };
