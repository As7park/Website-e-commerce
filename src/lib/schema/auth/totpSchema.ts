// src/lib/schemas.ts
import { z } from 'zod';

export const totpSchema = z.object({
	code: z.string().length(6, 'Le code doit contenir exactement 6 caractères'),
	encodedTOTPKey: z.string()
});

export type totpForm = z.infer<typeof totpSchema>;
