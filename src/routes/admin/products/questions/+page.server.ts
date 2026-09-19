import { fail, message, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { assertAdmin, requireAdmin } from '$lib/admin/guards';
import { deleteQuestionSchema } from '$lib/schema/products/questionSchema';
import { deleteQuestionById, getAllQuestions } from '$lib/prisma/productQuestions/productQuestions';

/**
 * Modération des questions produit (Q&A).
 *
 * PRODUCT-PLUGIN / ADMIN-PLUGIN : liste + suppression ici ; répondre se fait
 * depuis la fiche dédiée `/admin/products/questions/[id]` (un champ de plus
 * dans ce tableau serait illisible pour un texte de réponse).
 */
export const load = (async ({ url, locals }) => {
	assertAdmin(locals);

	const { items, total, page, perPage, search, sort, dir } = await getAllQuestions({
		page: Number(url.searchParams.get('page')) || undefined,
		perPage: Number(url.searchParams.get('perPage')) || undefined,
		search: url.searchParams.get('q') ?? undefined,
		sort: url.searchParams.get('sort') ?? undefined,
		dir: url.searchParams.get('dir') === 'desc' ? 'desc' : undefined
	});

	const deleteForm = await superValidate(zod(deleteQuestionSchema));

	return { questions: items, total, page, perPage, search, sort, dir, deleteForm };
}) satisfies PageServerLoad;

export const actions: Actions = {
	deleteQuestion: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(deleteQuestionSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await deleteQuestionById(form.data.id);
			return message(form, 'Question supprimée');
		} catch (error) {
			console.error('Error deleting product question:', error);
			return fail(500, { form, message: "La suppression n'a pas pu être enregistrée." });
		}
	}
};
