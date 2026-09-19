// src/lib/schema/loginSchema.ts
import { z } from 'zod';

export const loginSchema = z.object({
	email: z.string().email('Veuillez entrer une adresse email valide.'),
	password: z
		.string()
		.min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
		.max(64, 'Le mot de passe ne doit pas dépasser 64 caractères.')
});

export type LoginForm = z.infer<typeof loginSchema>;
