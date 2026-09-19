import { z } from 'zod';

const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const createBlogTaxonomySchema = z.object({
	name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
	slug: z
		.string()
		.min(2, 'Le slug doit contenir au moins 2 caractères')
		.regex(slugRegex, 'Le slug doit être en minuscules, sans espaces ni accents (ex: categorie)'),
	multiple: z.boolean().default(true)
});

const updateBlogTaxonomySchema = createBlogTaxonomySchema.extend({
	id: z.string()
});

const deleteBlogTaxonomySchema = z.object({
	id: z.string()
});

type CreateBlogTaxonomy = z.infer<typeof createBlogTaxonomySchema>;
type UpdateBlogTaxonomy = z.infer<typeof updateBlogTaxonomySchema>;
type DeleteBlogTaxonomy = z.infer<typeof deleteBlogTaxonomySchema>;

export { createBlogTaxonomySchema, updateBlogTaxonomySchema, deleteBlogTaxonomySchema };
export type { CreateBlogTaxonomy, UpdateBlogTaxonomy, DeleteBlogTaxonomy };
