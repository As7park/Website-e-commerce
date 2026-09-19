/**
 * Accès Prisma aux valeurs d'une taxonomie (`TaxonomyValue`), y compris leur
 * hiérarchie optionnelle (`parentId`). Le nombre de valeurs par taxonomie
 * reste petit (facette catalogue) : la résolution de l'arbre et de ses
 * descendants se fait en mémoire plutôt qu'en SQL récursif.
 */
import { prisma } from '$lib/server';
import { bumpCacheVersion } from '$lib/server/cache';
import type { TaxonomyValue } from '@prisma/client';

export const getValuesByTaxonomyId = async (taxonomyId: string) => {
	return prisma.taxonomyValue.findMany({
		where: { taxonomyId },
		orderBy: { value: 'asc' }
	});
};

export const getTaxonomyValueById = async (id: string) => {
	return prisma.taxonomyValue.findUnique({ where: { id } });
};

export const getTaxonomyValuesByIds = async (ids: string[]) => {
	if (ids.length === 0) return [];
	return prisma.taxonomyValue.findMany({ where: { id: { in: ids } } });
};

export const createTaxonomyValue = async (data: {
	taxonomyId: string;
	value: string;
	label?: string | null;
	description?: string | null;
	image?: string | null;
	code?: string | null;
	parentId?: string | null;
}) => {
	const created = await prisma.taxonomyValue.create({ data });
	await bumpCacheVersion('catalog');
	return created;
};

export const updateTaxonomyValue = async (data: {
	id: string;
	value: string;
	label?: string | null;
	description?: string | null;
	image?: string | null;
	code?: string | null;
	parentId?: string | null;
}) => {
	const { id, ...rest } = data;
	const updated = await prisma.taxonomyValue.update({ where: { id }, data: rest });
	await bumpCacheVersion('catalog');
	return updated;
};

/** Supprime la valeur ; ses éventuels enfants et assignations produit suivent (cascade DB). */
export const deleteTaxonomyValueById = async (id: string) => {
	const deleted = await prisma.taxonomyValue.delete({ where: { id } });
	await bumpCacheVersion('catalog');
	return deleted;
};

export type TaxonomyValueNode = TaxonomyValue & { children: TaxonomyValueNode[] };

/** Reconstruit l'arbre parent/enfant à partir de la liste à plat d'une taxonomie. */
export function buildValueTree(values: TaxonomyValue[]): TaxonomyValueNode[] {
	const nodes = new Map<string, TaxonomyValueNode>(
		values.map((v) => [v.id, { ...v, children: [] }])
	);
	const roots: TaxonomyValueNode[] = [];

	for (const node of nodes.values()) {
		if (node.parentId && nodes.has(node.parentId)) {
			nodes.get(node.parentId)!.children.push(node);
		} else {
			roots.push(node);
		}
	}
	return roots;
}

/**
 * Ids de `valueId` et de tous ses descendants — sert à faire remonter les
 * produits d'une sous-valeur quand le filtre catalogue sélectionne un parent.
 */
export function resolveDescendantIds(values: TaxonomyValue[], valueId: string): string[] {
	const childrenOf = new Map<string, string[]>();
	for (const v of values) {
		if (!v.parentId) continue;
		const siblings = childrenOf.get(v.parentId) ?? [];
		siblings.push(v.id);
		childrenOf.set(v.parentId, siblings);
	}

	const result: string[] = [];
	const queue = [valueId];
	while (queue.length > 0) {
		const current = queue.shift()!;
		result.push(current);
		for (const childId of childrenOf.get(current) ?? []) queue.push(childId);
	}
	return result;
}

/** Empêche d'assigner comme parent une valeur qui est elle-même un descendant (créerait un cycle). */
export function wouldCreateCycle(
	values: TaxonomyValue[],
	valueId: string,
	candidateParentId: string
): boolean {
	if (valueId === candidateParentId) return true;
	return resolveDescendantIds(values, valueId).includes(candidateParentId);
}
