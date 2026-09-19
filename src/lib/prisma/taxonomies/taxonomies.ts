/**
 * Accès Prisma au système générique de taxonomies (Matière, Catégorie, Couleur...).
 *
 * PRODUCT-PLUGIN : remplace à terme `$lib/prisma/materials` et
 * `$lib/prisma/categories/categories.ts` — une `Taxonomy` est le type
 * (« Matière »), ses `TaxonomyValue` sont les valeurs possibles (voir
 * `./taxonomyValues.ts`).
 *
 * `bumpCacheVersion('catalog')` invalide le cache de lecture publique
 * (`$lib/products/catalog`) après chaque écriture — voir `src/lib/server/cache.ts`.
 */
import { prisma } from '$lib/server';
import { bumpCacheVersion } from '$lib/server/cache';
import type { TaxonomyType } from '@prisma/client';

export const getAllTaxonomies = async () => {
	return prisma.taxonomy.findMany({
		orderBy: { name: 'asc' },
		include: { _count: { select: { values: true } } }
	});
};

/** Pour les écrans qui ont besoin des valeurs (formulaire produit, filtres catalogue). */
export const getAllTaxonomiesWithValues = async () => {
	return prisma.taxonomy.findMany({
		orderBy: { name: 'asc' },
		include: { values: { orderBy: { value: 'asc' } } }
	});
};

export const getTaxonomyById = async (id: string) => {
	return prisma.taxonomy.findUnique({
		where: { id },
		include: { values: { orderBy: { value: 'asc' } } }
	});
};

export const getTaxonomyBySlug = async (slug: string) => {
	return prisma.taxonomy.findUnique({
		where: { slug },
		include: { values: { orderBy: { value: 'asc' } } }
	});
};

export const createTaxonomy = async (data: {
	name: string;
	slug: string;
	type: TaxonomyType;
	multiple: boolean;
	numberMin?: number | null;
	numberMax?: number | null;
	numberUnit?: string | null;
}) => {
	const taxonomy = await prisma.taxonomy.create({ data });
	await bumpCacheVersion('catalog');
	return taxonomy;
};

export const updateTaxonomy = async (data: {
	id: string;
	name: string;
	slug: string;
	type: TaxonomyType;
	multiple: boolean;
	numberMin?: number | null;
	numberMax?: number | null;
	numberUnit?: string | null;
}) => {
	const { id, ...rest } = data;
	const taxonomy = await prisma.taxonomy.update({
		where: { id },
		data: rest
	});
	await bumpCacheVersion('catalog');
	return taxonomy;
};

/** Supprime la taxonomie, ses valeurs et leurs assignations produit (cascade DB). */
export const deleteTaxonomyById = async (id: string) => {
	const deleted = await prisma.taxonomy.delete({ where: { id } });
	await bumpCacheVersion('catalog');
	return deleted;
};
