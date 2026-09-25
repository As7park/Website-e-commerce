/** Taux de TVA (`/admin/settings`) — saisi en pourcentage, converti en fraction avant écriture. */
import { z } from 'zod';

export const vatRateSchema = z.object({
	vatRatePercent: z
		.number({ invalid_type_error: 'Le taux est requis' })
		.min(0, 'Le taux doit être positif')
		.max(100, 'Le taux ne peut pas dépasser 100 %')
});
