import { z } from 'zod';

// Schema for creating a blog post
const createBlogPostSchema = z.object({
	title: z
		.string()
		.min(1, { message: 'Title is required and cannot be empty' })
		.describe('The title of the blog post'),
	content: z
		.string()
		.min(1, { message: 'Content is required and cannot be empty' })
		.describe('The content of the blog post'),
	published: z.boolean().describe('Whether the blog post is published or not'),
	authorId: z.string(),
	taxonomyValueIds: z
		.array(z.string())
		.nullable()
		.describe("Valeurs de taxonomie (catégorie, tags...) assignées à l'article")
});

// Schema for updating a blog post
const updateBlogPostSchema = z.object({
	id: z.string(),
	title: z
		.string()
		.min(1, { message: 'Title is required and cannot be empty' })
		.describe('The title of the blog post'),
	content: z
		.string()
		.min(1, { message: 'Content is required and cannot be empty' })
		.describe('The content of the blog post'),
	published: z.boolean().describe('Whether the blog post is published or not'),
	authorId: z.string(),
	taxonomyValueIds: z
		.array(z.string())
		.optional()
		.describe("Valeurs de taxonomie (catégorie, tags...) assignées à l'article")
});

// Schema for deleting a blog post
const deleteBlogPostSchema = z.object({
	id: z.string()
});

// Infer types from schemas
type CreateBlogPost = z.infer<typeof createBlogPostSchema>;
type UpdateBlogPost = z.infer<typeof updateBlogPostSchema>;
type DeleteBlogPost = z.infer<typeof deleteBlogPostSchema>;

// Exports
export { createBlogPostSchema, updateBlogPostSchema, deleteBlogPostSchema };
export type { CreateBlogPost, UpdateBlogPost, DeleteBlogPost };
