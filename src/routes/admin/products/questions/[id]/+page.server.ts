import type { PageServerLoad, Actions } from './$types';
import { error } from '@sveltejs/kit';
import { superValidate, fail, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { answerQuestionSchema } from '$lib/schema/products/questionSchema';
import { answerQuestion, getQuestionById } from '$lib/prisma/productQuestions/productQuestions';
import { requireAdmin } from '$lib/admin/guards';

export const load: PageServerLoad = async ({ params }) => {
	const question = await getQuestionById(params.id);

	if (!question) {
		error(404, 'Question introuvable');
	}

	const answerForm = await superValidate(
		{ id: question.id, answer: question.answer ?? undefined },
		zod(answerQuestionSchema)
	);

	return { question, answerForm };
};

export const actions: Actions = {
	answerQuestion: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const form = await superValidate(formData, zod(answerQuestionSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await answerQuestion(form.data.id, form.data.answer);
			return message(form, 'Réponse publiée avec succès');
		} catch (error) {
			console.error('Error answering product question:', error);
			return fail(500, { form, message: "La réponse n'a pas pu être enregistrée." });
		}
	}
};
