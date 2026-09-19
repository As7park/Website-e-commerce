import { fail, message, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { assertAdmin, requireAdmin } from '$lib/admin/guards';
import { deleteReviewSchema } from '$lib/schema/products/reviewSchema';
import { deleteReviewById, getAllReviews } from '$lib/prisma/reviews/reviews';

/**
 * Modération des avis produit.
 *
 * PRODUCT-PLUGIN / ADMIN-PLUGIN : lecture + suppression uniquement — un avis
 * ne se modifie pas depuis l'admin, il se retire (contenu rédigé par le
 * client, pas un champ éditorial).
 */
export const load = (async ({ url, locals }) => {
	assertAdmin(locals);

	const { items, total, page, perPage, search, sort, dir } = await getAllReviews({
		page: Number(url.searchParams.get('page')) || undefined,
		perPage: Number(url.searchParams.get('perPage')) || undefined,
		search: url.searchParams.get('q') ?? undefined,
		sort: url.searchParams.get('sort') ?? undefined,
		dir: url.searchParams.get('dir') === 'desc' ? 'desc' : undefined
	});

	const deleteForm = await superValidate(zod(deleteReviewSchema));

	return { reviews: items, total, page, perPage, search, sort, dir, deleteForm };
}) satisfies PageServerLoad;

export const actions: Actions = {
	deleteReview: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(deleteReviewSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await deleteReviewById(form.data.id);
			return message(form, 'Avis supprimé');
		} catch (error) {
			console.error('Error deleting review:', error);
			return fail(500, { form, message: "La suppression n'a pas pu être enregistrée." });
		}
	}
};
