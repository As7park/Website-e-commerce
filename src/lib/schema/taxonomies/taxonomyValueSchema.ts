import { z } from 'zod';

// Champs communs à tous les types de taxonomie ; la validation propre au
// `type` de la taxonomie parente (hex pour COLOR, plage pour NUMBER, etc.)
// est faite dans l'action serveur, qui seule connaît ce type à l'exécution.
const createTaxonomyValueSchema = z.object({
	taxonomyId: z.string(),
	value: z.string().min(1, 'La valeur est requise'),
	label: z.string().trim().max(120).optional().or(z.literal('')),
	description: z.string().trim().max(500).optional().or(z.literal('')),
	image: z.string().trim().optional().or(z.literal('')),
	code: z.string().trim().optional().or(z.literal('')),
	parentId: z.string().optional().or(z.literal(''))
});

const updateTaxonomyValueSchema = createTaxonomyValueSchema.extend({
	id: z.string()
});

const deleteTaxonomyValueSchema = z.object({
	id: z.string()
});

type CreateTaxonomyValue = z.infer<typeof createTaxonomyValueSchema>;
type UpdateTaxonomyValue = z.infer<typeof updateTaxonomyValueSchema>;
type DeleteTaxonomyValue = z.infer<typeof deleteTaxonomyValueSchema>;

export { createTaxonomyValueSchema, updateTaxonomyValueSchema, deleteTaxonomyValueSchema };
export type { CreateTaxonomyValue, UpdateTaxonomyValue, DeleteTaxonomyValue };
