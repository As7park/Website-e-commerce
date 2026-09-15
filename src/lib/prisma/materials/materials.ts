/**
 * Accès Prisma à la taxonomie « Matière » du catalogue produit.
 *
 * PRODUCT-PLUGIN : même esprit que `$lib/prisma/categories/categories.ts` —
 * une valeur gérée en admin plutôt qu'un champ texte libre sur `Product`,
 * pour que le filtre catalogue (`getCatalogFacets`) reste cohérent.
 *
 * `bumpCacheVersion('catalog')` invalide le cache de lecture publique
 * (`$lib/products/catalog`) après chaque écriture.
 */
import { prisma } from '$lib/server';
import { bumpCacheVersion } from '$lib/server/cache';

export const getAllMaterials = async () => {
	return prisma.material.findMany({ orderBy: { name: 'asc' } });
};

export const getMaterialById = async (id: string) => {
	return prisma.material.findUnique({ where: { id } });
};

export const createMaterial = async (data: { name: string }) => {
	const material = await prisma.material.create({ data });
	await bumpCacheVersion('catalog');
	return material;
};

export const updateMaterial = async (data: { id: string; name: string }) => {
	const material = await prisma.material.update({
		where: { id: data.id },
		data: { name: data.name }
	});
	await bumpCacheVersion('catalog');
	return material;
};

/**
 * Supprimer une matière ne bloque jamais sur les produits qui l'utilisent
 * (`onDelete: SetNull`) — contrairement à une catégorie, ce n'est pas une
 * relation many-to-many à nettoyer d'abord.
 */
export const deleteMaterialById = async (id: string) => {
	const deleted = await prisma.material.delete({ where: { id } });
	await bumpCacheVersion('catalog');
	return deleted;
};
