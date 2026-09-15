/**
 * PRODUCT-PLUGIN : schémas Zod des variantes produit (admin).
 *
 * `price` suit le même piège déjà rencontré sur `compareAtPrice`
 * (`productSchema.ts`) : un type union (`number | ''`) fait échouer le
 * parsing FormData de superforms (« Unions are only supported when the
 * dataType is json »). Un seul type numérique avec `0` = « pas de
 * surcharge, utiliser le prix du produit » évite le problème.
 */
import { z } from 'zod';

const baseVariantSchema = z.object({
	label: z.string().trim().min(1, "L'étiquette est requise").max(120, 'Étiquette trop longue'),
	sku: z.string().trim().max(60, 'SKU trop long').optional(),
	price: z.coerce.number().min(0, 'Le prix doit être positif').default(0),
	stock: z.coerce.number().int('Nombre entier attendu').min(0, 'Le stock doit être positif').default(0)
});

export const createVariantSchema = baseVariantSchema;

export const updateVariantSchema = baseVariantSchema.extend({
	id: z.string()
});

export const deleteVariantSchema = z.object({
	id: z.string()
});

export type CreateVariant = z.infer<typeof createVariantSchema>;
export type UpdateVariant = z.infer<typeof updateVariantSchema>;
