import { z } from 'zod';

const createMaterialSchema = z.object({
	name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères')
});

const updateMaterialSchema = z.object({
	id: z.string(),
	name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères')
});

const deleteMaterialSchema = z.object({
	id: z.string()
});

type CreateMaterial = z.infer<typeof createMaterialSchema>;
type UpdateMaterial = z.infer<typeof updateMaterialSchema>;
type DeleteMaterial = z.infer<typeof deleteMaterialSchema>;

export { createMaterialSchema, updateMaterialSchema, deleteMaterialSchema };
export type { CreateMaterial, UpdateMaterial, DeleteMaterial };
