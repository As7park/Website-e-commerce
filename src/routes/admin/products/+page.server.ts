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
import { deleteTaxonomySchema } from '$lib/schema/taxonomies/taxonomySchema';

import {
	getAllTaxonomies,
	deleteTaxonomyById,
	getTaxonomyById
} from '$lib/prisma/taxonomies/taxonomies';
import {
	deleteProductById,
	getAllProducts,
	getProductById,
	ProductInUseError
} from '$lib/prisma/products/products';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ url }) => {
	const IdeleteProductSchema = await superValidate(zod(deleteProductSchema));
	const IdeleteTaxonomySchema = await superValidate(zod(deleteTaxonomySchema));
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
	const taxonomies = await getAllTaxonomies();

	return {
		products,
		total,
		page,
		perPage,
		search,
		sort,
		dir,
		IdeleteProductSchema,
		IdeleteTaxonomySchema,
		taxonomies
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
	bulkDeleteProducts: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const ids = formData.getAll('ids').filter((id): id is string => typeof id === 'string' && id.length > 0);

		if (ids.length === 0) {
			return fail(400, { message: 'Aucun produit sélectionné' });
		}

		let deleted = 0;
		let skipped = 0;
		for (const id of ids) {
			try {
				const existingProduct = await getProductById(id);
				if (!existingProduct) continue;

				await deleteProductById(id);
				deleted += 1;

				for (const imageUrl of existingProduct.images) {
					const publicId = getPublicIdFromUrl(imageUrl);
					if (!publicId || !imageUrl.includes('cloudinary')) continue;
					try {
						await cloudinary.uploader.destroy(`products/${publicId}`);
					} catch (error) {
						console.error('Error deleting image from Cloudinary:', error);
					}
				}
			} catch (error) {
				if (error instanceof ProductInUseError) {
					// Produit déjà commandé (FK Restrict) : on l'ignore plutôt que de
					// faire échouer tout le lot pour une seule ligne bloquée.
					skipped += 1;
					continue;
				}
				console.error('Error bulk deleting product:', id, error);
				skipped += 1;
			}
		}

		return { deleted, skipped };
	},
	deleteTaxonomy: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(deleteTaxonomySchema));
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { message: 'Taxonomy ID is required' });
		}
		try {
			const existingTaxonomy = await getTaxonomyById(id);
			if (!existingTaxonomy) {
				return fail(400, { message: 'Taxonomy not found' });
			}

			await deleteTaxonomyById(id);

			return message(form, 'Taxonomy deleted successfully');
		} catch (error) {
			console.error('Error deleting taxonomy:', error);
			return fail(500, { message: 'Taxonomy deletion failed' });
		}
	}
};

const getPublicIdFromUrl = (url: string): string | null => {
	const regex = /\/([^/]+)\.[a-z]+$/;
	const match = url.match(regex);
	return match ? match[1] : null;
};
