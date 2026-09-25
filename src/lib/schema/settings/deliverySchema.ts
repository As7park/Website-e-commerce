/**
 * Délai de livraison estimé (`/admin/settings`) — les deux bornes vides
 * ensemble = rien affiché au client ; sinon les deux sont requises et
 * cohérentes (Code conso. art. L216-1).
 */
import { z } from 'zod';

export const deliveryEstimateSchema = z
	.object({
		minDays: z.coerce
			.number({ invalid_type_error: 'Nombre de jours requis' })
			.int('Nombre de jours entier')
			.min(1, 'Au moins 1 jour')
			.max(60, 'Maximum 60 jours')
			.optional(),
		maxDays: z.coerce
			.number({ invalid_type_error: 'Nombre de jours requis' })
			.int('Nombre de jours entier')
			.min(1, 'Au moins 1 jour')
			.max(60, 'Maximum 60 jours')
			.optional()
	})
	.refine((data) => (data.minDays == null) === (data.maxDays == null), {
		message: 'Renseignez les deux bornes, ou laissez les deux vides pour ne rien afficher',
		path: ['maxDays']
	})
	.refine((data) => data.minDays == null || data.maxDays == null || data.minDays <= data.maxDays, {
		message: 'Le minimum doit être inférieur ou égal au maximum',
		path: ['maxDays']
	});
