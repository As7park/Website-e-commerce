/**
 * Liste des produits, suppression, catégories.
 *
 * PRODUCT-PLUGIN : les gardes d'écriture sont celles de l'admin. Un produit
 * déjà commandé ne peut pas être effacé (`ProductInUseError`).
 */
import type { PageServerLoad } from './$types';
import { type Actions } from '@sveltejs/kit';
import { superValidate, fail, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import cloudinary from '$lib/server/cloudinary';

import { deleteProductSchema } from '$lib/schema/products/productSchema';
import { deleteCategorySchema } from '$lib/schema/categories/deleteCategorySchema';
import { deleteMaterialSchema } from '$lib/schema/materials/materialSchema';

import {
	deleteCategoryById,
	deleteProductCategoriesByCategoryId,
	getAllcategories,
	getCategoriesById
} from '$lib/prisma/categories/categories';
import { deleteMaterialById, getAllMaterials, getMaterialById } from '$lib/prisma/materials/materials';
import {
	deleteProductById,
	getAllProducts,
	getProductById,
	ProductInUseError
} from '$lib/prisma/products/products';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ url }) => {
	const IdeleteProductSchema = await superValidate(zod(deleteProductSchema));
	const IdeleteCategorySchema = await superValidate(zod(deleteCategorySchema));
	const IdeleteMaterialSchema = await superValidate(zod(deleteMaterialSchema));
	const {
		items: products,
		total,
		page,
		perPage,
		search,
		sort,
		dir
	} = await getAllProducts({
		page: Number(url.searchParams.get('page')) || undefined,
		perPage: Number(url.searchParams.get('perPage')) || undefined,
		search: url.searchParams.get('q') ?? undefined,
		sort: url.searchParams.get('sort') ?? undefined,
		dir: url.searchParams.get('dir') === 'desc' ? 'desc' : undefined
	});
	const [categories, materials] = await Promise.all([getAllcategories(), getAllMaterials()]);

	return {
		products,
		total,
		page,
		perPage,
		search,
		sort,
		dir,
		IdeleteCategorySchema,
		IdeleteMaterialSchema,
		IdeleteProductSchema,
		categories,
		materials
	};
};

export const actions: Actions = {
	deleteProduct: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(deleteProductSchema));
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { message: 'Product ID is required' });
		}
		try {
			const existingProduct = await getProductById(id);
			if (!existingProduct) {
				return fail(400, { message: 'Product not found' });
			}

			await deleteProductById(id);

			for (const imageUrl of existingProduct.images) {
				const publicId = getPublicIdFromUrl(imageUrl);
				if (!publicId || !imageUrl.includes('cloudinary')) continue;
				try {
					await cloudinary.uploader.destroy(`products/${publicId}`);
				} catch (error) {
					console.error('Error deleting image from Cloudinary:', error);
				}
			}

			return message(form, 'Product deleted successfully');
		} catch (error) {
			if (error instanceof ProductInUseError) {
				return fail(409, { message: error.message });
			}
			console.error('Error deleting product:', error);
			return fail(500, { message: 'Product deletion failed' });
		}
	},
	deleteCategory: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(deleteCategorySchema));
		// Table.svelte soumet toujours le champ caché sous le nom `id` pour une
		// action de type `form`, jamais `categoryId` — lire le mauvais champ ici
		// faisait échouer la suppression à coup sûr (« Category ID is required »).
		const categoryId = formData.get('id') as string;

		if (!categoryId) {
			return fail(400, { message: 'Category ID is required' });
		}
		try {
			const existingCategory = await getCategoriesById(categoryId);
			if (!existingCategory) {
				return fail(400, { message: 'Category not found' });
			}

			await deleteProductCategoriesByCategoryId(categoryId);

			await deleteCategoryById(categoryId);

			return message(form, 'Category deleted successfully');
		} catch (error) {
			console.error('Error deleting category:', error);
			return fail(500, { message: 'Category deletion failed' });
		}
	},
	deleteMaterial: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(deleteMaterialSchema));
		const materialId = formData.get('id') as string;

		if (!materialId) {
			return fail(400, { message: 'Material ID is required' });
		}
		try {
			const existingMaterial = await getMaterialById(materialId);
			if (!existingMaterial) {
				return fail(400, { message: 'Material not found' });
			}

			await deleteMaterialById(materialId);

			return message(form, 'Material deleted successfully');
		} catch (error) {
			console.error('Error deleting material:', error);
			return fail(500, { message: 'Material deletion failed' });
		}
	}
};

const getPublicIdFromUrl = (url: string): string | null => {
	const regex = /\/([^/]+)\.[a-z]+$/;
	const match = url.match(regex);
	return match ? match[1] : null;
};
