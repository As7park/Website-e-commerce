import { z } from 'zod';

export const recoveryCodeSchema = z.object({
	code: z.string().length(16, 'Le code doit contenir 16 chiffres.')
});

export type recoveryCodeForm = z.infer<typeof recoveryCodeSchema>;
