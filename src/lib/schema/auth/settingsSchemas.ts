import { z } from 'zod';

export const emailSchema = z.object({
	email: z.string().email('Veuillez entrer une adresse email valide.')
});

export const passwordSchema = z.object({
	password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
	new_password: z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères.')
});
