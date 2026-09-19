import { z } from 'zod';

export const forgotPasswordSchema = z.object({
	email: z
		.string()
		.nonempty('Veuillez entrer votre adresse email.')
		.email('Veuillez entrer une adresse email valide.')
});

export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
