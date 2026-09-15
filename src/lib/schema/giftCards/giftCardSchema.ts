/** Schémas Zod des formulaires admin « Cartes cadeaux ». */
import { z } from 'zod';

// Un seul type (`string | undefined`), jamais une union avec `z.literal('')` :
// superforms échoue à parser un `FormData` sur un champ union (« Unions are
// only supported when dataType is json »). `.refine()` sur un champ précis
// garde ce type simple tout en tolérant la chaîne vide (champ optionnel).
const optionalEmail = z
	.string()
	.optional()
	.refine((value) => !value || z.string().email().safeParse(value).success, {
		message: 'Email invalide'
	});

const createGiftCardSchema = z.object({
	initialValue: z
		.number({ invalid_type_error: 'La valeur est requise' })
		.positive('La valeur doit être supérieure à 0'),
	recipientEmail: optionalEmail,
	note: z.string().max(500, 'Note trop longue (500 caractères max)').optional(),
	expiresAt: z.string().optional()
});

const updateGiftCardSchema = z.object({
	id: z.string(),
	active: z.boolean(),
	recipientEmail: optionalEmail,
	note: z.string().max(500, 'Note trop longue (500 caractères max)').optional(),
	expiresAt: z.string().optional()
});

/**
 * Ajustement manuel du solde (SAV) : formulaire séparé de `updateGiftCard`
 * pour que ce geste reste explicite (pas un champ parmi d'autres à côté du
 * statut/de la note).
 */
const adjustGiftCardBalanceSchema = z.object({
	id: z.string(),
	balance: z.number({ invalid_type_error: 'Le solde est requis' }).min(0, 'Le solde doit être positif ou nul')
});

const deleteGiftCardSchema = z.object({
	id: z.string()
});

type CreateGiftCard = z.infer<typeof createGiftCardSchema>;
type UpdateGiftCard = z.infer<typeof updateGiftCardSchema>;
type AdjustGiftCardBalance = z.infer<typeof adjustGiftCardBalanceSchema>;
type DeleteGiftCard = z.infer<typeof deleteGiftCardSchema>;

export {
	createGiftCardSchema,
	updateGiftCardSchema,
	adjustGiftCardBalanceSchema,
	deleteGiftCardSchema
};
export type { CreateGiftCard, UpdateGiftCard, AdjustGiftCardBalance, DeleteGiftCard };
