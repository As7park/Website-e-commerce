import { z } from 'zod';

// Schema for isMfaEnabled switch
const isMfaEnabledSchema = z.object({
	isMfaEnabled: z.boolean().describe('MFA Enabled Status') // Directly ensures a boolean type
});

type isMfaEnabled = z.infer<typeof isMfaEnabledSchema>;

export { isMfaEnabledSchema };
export type { isMfaEnabled };
