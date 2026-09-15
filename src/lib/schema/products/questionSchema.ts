/** PRODUCT-PLUGIN : schémas Zod du Q&A produit (public + modération admin). */
import { z } from 'zod';

export const askQuestionSchema = z.object({
	question: z
		.string()
		.trim()
		.min(5, 'Votre question est trop courte.')
		.max(500, 'La question ne doit pas dépasser 500 caractères.')
});

/** ADMIN-PLUGIN : réponse depuis la modération (`/admin/products/questions/[id]`). */
export const answerQuestionSchema = z.object({
	id: z.string(),
	answer: z
		.string()
		.trim()
		.min(1, 'La réponse est requise.')
		.max(2000, 'La réponse ne doit pas dépasser 2000 caractères.')
});

/** ADMIN-PLUGIN : suppression depuis la modération. */
export const deleteQuestionSchema = z.object({
	id: z.string()
});
