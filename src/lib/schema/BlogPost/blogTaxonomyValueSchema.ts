import { z } from 'zod';

const createBlogTaxonomyValueSchema = z.object({
	taxonomyId: z.string(),
	value: z.string().min(1, 'La valeur est requise'),
	label: z.string().trim().max(120).optional().or(z.literal(''))
});

const updateBlogTaxonomyValueSchema = createBlogTaxonomyValueSchema.extend({
	id: z.string()
});

const deleteBlogTaxonomyValueSchema = z.object({
	id: z.string()
});

type CreateBlogTaxonomyValue = z.infer<typeof createBlogTaxonomyValueSchema>;
type UpdateBlogTaxonomyValue = z.infer<typeof updateBlogTaxonomyValueSchema>;
type DeleteBlogTaxonomyValue = z.infer<typeof deleteBlogTaxonomyValueSchema>;

export {
	createBlogTaxonomyValueSchema,
	updateBlogTaxonomyValueSchema,
	deleteBlogTaxonomyValueSchema
};
export type { CreateBlogTaxonomyValue, UpdateBlogTaxonomyValue, DeleteBlogTaxonomyValue };
