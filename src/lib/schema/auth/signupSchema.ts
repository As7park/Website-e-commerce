// src/lib/schemas.ts
import { z } from 'zod';

export const signupSchema = z.object({
	username: z
		.string()
		.min(4, { message: "Le nom d'utilisateur doit contenir au moins 4 caractères." })
		.max(31),
	email: z.string().email({ message: "L'email n'est pas valide." }),
	password: z
		.string()
		.min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
		.regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule.')
		.regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule.')
		.regex(/\d/, 'Le mot de passe doit contenir au moins un chiffre.')
		.regex(/[\W_]/, 'Le mot de passe doit contenir au moins un caractère spécial.')
});

export type SignupForm = z.infer<typeof signupSchema>;
