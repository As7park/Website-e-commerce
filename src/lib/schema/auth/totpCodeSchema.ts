// src/lib/schemas.ts
import { z } from 'zod';

export const totpCodeSchema = z.object({
	code: z.string().length(6, 'Le code doit contenir exactement 6 caractères')
});

export type totpCodeForm = z.infer<typeof totpCodeSchema>;
