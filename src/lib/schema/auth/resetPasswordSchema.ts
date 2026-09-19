import { z } from 'zod';

export const resetPasswordSchema = z.object({
	password: z
		.string()
		.min(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
		.regex(/[A-Z]/, { message: 'Le mot de passe doit contenir une lettre majuscule' })
		.regex(/[a-z]/, { message: 'Le mot de passe doit contenir une lettre minuscule' })
		.regex(/\d/, { message: 'Le mot de passe doit contenir un chiffre' })
});
