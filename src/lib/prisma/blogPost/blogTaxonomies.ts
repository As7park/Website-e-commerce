/**
 * Accès Prisma au système de taxonomies du blog (Catégorie, Tag, et toute
 * facette future créée par l'admin sans nouvelle migration).
 *
 * BLOG-PLUGIN : mirroring volontaire de `$lib/prisma/taxonomies` (produits)
 * mais sur des tables dédiées (`BlogTaxonomy`/`BlogTaxonomyValue`), pour ne
 * pas coupler le blog aux tables PRODUCT-PLUGIN et garder le module retirable.
 * Pas de `type`/hiérarchie ici : les valeurs de taxonomie blog sont toujours
 * du texte simple, à plat.
 */
import { prisma } from '$lib/server';

export const getAllBlogTaxonomies = async () => {
	return prisma.blogTaxonomy.findMany({
		orderBy: { name: 'asc' },
		include: { _count: { select: { values: true } } }
	});
};

/** Pour les écrans qui ont besoin des valeurs (formulaire article, filtre vitrine). */
export const getAllBlogTaxonomiesWithValues = async () => {
	return prisma.blogTaxonomy.findMany({
		orderBy: { name: 'asc' },
		include: { values: { orderBy: { value: 'asc' } } }
	});
};

export const getBlogTaxonomyById = async (id: string) => {
	return prisma.blogTaxonomy.findUnique({
		where: { id },
		include: { values: { orderBy: { value: 'asc' } } }
	});
};

export const getBlogTaxonomyBySlug = async (slug: string) => {
	return prisma.blogTaxonomy.findUnique({
		where: { slug },
		include: { values: { orderBy: { value: 'asc' } } }
	});
};

export const createBlogTaxonomy = async (data: {
	name: string;
	slug: string;
	multiple: boolean;
}) => {
	return prisma.blogTaxonomy.create({ data });
};

export const updateBlogTaxonomy = async (data: {
	id: string;
	name: string;
	slug: string;
	multiple: boolean;
}) => {
	const { id, ...rest } = data;
	return prisma.blogTaxonomy.update({ where: { id }, data: rest });
};

/** Supprime la taxonomie, ses valeurs et leurs assignations d'article (cascade DB). */
export const deleteBlogTaxonomyById = async (id: string) => {
	return prisma.blogTaxonomy.delete({ where: { id } });
};

export const getBlogTaxonomyValueById = async (id: string) => {
	return prisma.blogTaxonomyValue.findUnique({ where: { id } });
};

export const getBlogTaxonomyValuesByIds = async (ids: string[]) => {
	if (ids.length === 0) return [];
	return prisma.blogTaxonomyValue.findMany({ where: { id: { in: ids } } });
};

export const createBlogTaxonomyValue = async (data: {
	taxonomyId: string;
	value: string;
	label?: string | null;
}) => {
	return prisma.blogTaxonomyValue.create({ data });
};

export const updateBlogTaxonomyValue = async (data: {
	id: string;
	value: string;
	label?: string | null;
}) => {
	const { id, ...rest } = data;
	return prisma.blogTaxonomyValue.update({ where: { id }, data: rest });
};

/** Supprime la valeur ; ses assignations d'article suivent (cascade DB). */
export const deleteBlogTaxonomyValueById = async (id: string) => {
	return prisma.blogTaxonomyValue.delete({ where: { id } });
};
