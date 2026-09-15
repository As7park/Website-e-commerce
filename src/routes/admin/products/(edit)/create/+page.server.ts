// src/routes/your-route/+page.server.ts
import type { PageServerLoad } from './$types';
import { type Actions } from '@sveltejs/kit';
import { superValidate, fail, message, withFiles } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import cloudinary from '$lib/server/cloudinary';
import { createProductSchema } from '$lib/schema/products/productSchema';
import { slugify } from '$lib/prisma/slugify';
import { connectProductToCategories, connectProductToTaxonomyValues, createProduct } from '$lib/prisma/products/products';
import { getAllcategories, getCategoriesByIds } from '$lib/prisma/categories/categories';
import { getAllMaterials } from '$lib/prisma/materials/materials';
import { getAllTaxonomiesWithValues } from '$lib/prisma/taxonomies/taxonomies';
import { getTaxonomyValuesByIds } from '$lib/prisma/taxonomies/taxonomyValues';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async () => {
	const IcreateProductSchema = await superValidate(zod(createProductSchema));
	const [categories, materials, taxonomies] = await Promise.all([
		getAllcategories(),
		getAllMaterials(),
		getAllTaxonomiesWithValues()
	]);

	return {
		categories,
		materials,
		taxonomies,
		IcreateProductSchema
	};
};

export const actions: Actions = {
	createProduct: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();

		const form = await superValidate(formData, zod(createProductSchema));

		if (!form.valid) {
			return fail(400, withFiles({ form }));
		}

		if (form.data.compareAtPrice > 0 && form.data.compareAtPrice <= form.data.price) {
			form.errors.compareAtPrice = ['Le prix barré doit être supérieur au prix de vente'];
			form.valid = false;
			return fail(400, withFiles({ form }));
		}

		const images = formData.getAll('images') as File[];

		const uploadedImageUrls: string[] = [];

		for (const image of images) {
			if (image instanceof File) {
				try {
					const buffer = await image.arrayBuffer();
					const base64String = Buffer.from(buffer).toString('base64');

					const uploadResponse = await cloudinary.uploader.upload(
						`data:${image.type};base64,${base64String}`,
						{
							folder: 'products'
						}
					);

					uploadedImageUrls.push(uploadResponse.secure_url);
				} catch (error) {
					console.error('Error uploading image:', error);
					return fail(500, { message: 'Image upload failed' });
				}
			}
		}

		const categoryIdsString = formData.get('categoryId') as string;
		const categoryIds = categoryIdsString.split(',').map((id) => id.trim());

		const existingCategories = await getCategoriesByIds(categoryIds);

		const existingCategoryIds = existingCategories.map((cat) => cat.id);

		const missingCategories = categoryIds.filter((id) => !existingCategoryIds.includes(id));

		if (missingCategories.length > 0) {
			return fail(400, {
				message: `The following categories do not exist: ${missingCategories.join(', ')}`
			});
		}

		const slug = slugify(form.data.name);

		const taxonomyValueIdsString = formData.get('taxonomyValueIds') as string | null;
		const taxonomyValueIds = taxonomyValueIdsString
			? taxonomyValueIdsString.split(',').map((id) => id.trim()).filter(Boolean)
			: [];
		if (taxonomyValueIds.length > 0) {
			const existingValues = await getTaxonomyValuesByIds(taxonomyValueIds);
			if (existingValues.length !== taxonomyValueIds.length) {
				return fail(400, { message: 'Some selected taxonomy values do not exist' });
			}
		}

		try {
			const product = await createProduct({
				name: form.data.name,
				description: form.data.description,
				price: form.data.price,
				stock: form.data.stock,
				images: uploadedImageUrls,
				slug: slug,
				colorProduct: form.data.colorProduct,
				sku: form.data.sku || null,
				materialId: form.data.materialId || null,
				compareAtPrice: form.data.compareAtPrice || null
			});

			await connectProductToCategories(product.id, existingCategoryIds);
			await connectProductToTaxonomyValues(product.id, taxonomyValueIds);
			// console.log(form);

			return message(form, 'Product created successfully');
		} catch (error) {
			console.error('Error creating product:', error);
			return fail(500, { message: 'Product creation failed' });
		}
	}
};
