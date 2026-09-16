import { error, fail, type Actions } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { PageServerLoad } from './$types';
import { getProductBySlug, getRelatedProducts } from '$lib/products/catalog';
import { reviewSchema } from '$lib/schema/products/reviewSchema';
import {
	AlreadyReviewedError,
	createReview,
	getReviewSummary,
	getUserReviewForProduct,
	listReviewsForProduct
} from '$lib/prisma/reviews/reviews';
import { isInWishlist } from '$lib/prisma/wishlist/wishlist';
import { getStoreFeatureFlags } from '$lib/server/storeSettings';
import { askQuestionSchema } from '$lib/schema/products/questionSchema';
import {
	askQuestion,
	listPublicQuestionsForProduct
} from '$lib/prisma/productQuestions/productQuestions';

/**
 * Fiche produit publique.
 *
 * PRODUCT-PLUGIN : 404 si le slug n'existe pas. Les avis (`Review`) sont une
 * lecture à part, non mise en cache comme le reste du catalogue (volume
 * modeste, fraîcheur plus utile ici qu'ailleurs). Liste d'envies et ventes
 * croisées sont deux modules activables (`StoreSettings`) : leur lecture ne
 * se fait que si le flag correspondant est actif.
 * COMMERCE-PLUGIN : le bouton « Ajouter au panier » est sur la page cliente.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const product = await getProductBySlug(params.slug);
	if (!product) {
		error(404, 'Produit introuvable');
	}

	const userId = locals.user?.id;
	const { wishlistEnabled, crossSellEnabled, productQnaEnabled, flashSaleEnabled } =
		await getStoreFeatureFlags();
	const categoryIds = product.categories.map((link) => link.categoryId);

	const [
		reviewSummary,
		reviews,
		userReview,
		form,
		inWishlist,
		relatedProducts,
		questions,
		askForm
	] = await Promise.all([
		getReviewSummary(product.id),
		listReviewsForProduct(product.id),
		userId ? getUserReviewForProduct(product.id, userId) : null,
		superValidate(zod(reviewSchema)),
		wishlistEnabled && userId ? isInWishlist(userId, product.id) : false,
		crossSellEnabled ? getRelatedProducts(product.id, categoryIds) : [],
		productQnaEnabled ? listPublicQuestionsForProduct(product.id) : [],
		superValidate(zod(askQuestionSchema))
	]);

	return {
		product,
		reviewSummary,
		reviews,
		hasReviewed: Boolean(userReview),
		form,
		wishlistEnabled,
		inWishlist,
		relatedProducts,
		productQnaEnabled,
		flashSaleEnabled,
		questions,
		askForm
	};
};

export const actions: Actions = {
	review: async (event) => {
		const { locals, params } = event;
		if (!locals.user) {
			return fail(401, { message: 'Connectez-vous pour laisser un avis.' });
		}

		const form = await superValidate(event.request, zod(reviewSchema));
		if (!form.valid) {
			return fail(400, { form });
		}

		const product = await getProductBySlug(params.slug!);
		if (!product) {
			error(404, 'Produit introuvable');
		}

		try {
			await createReview({
				productId: product.id,
				userId: locals.user.id,
				rating: form.data.rating,
				comment: form.data.comment?.trim() || null
			});
			return message(form, 'Avis publié, merci !');
		} catch (err) {
			if (err instanceof AlreadyReviewedError) {
				return fail(409, { form, message: err.message });
			}
			console.error('Error creating review:', err);
			return fail(500, { form, message: "L'avis n'a pas pu être enregistré." });
		}
	},

	askQuestion: async (event) => {
		const { locals, params } = event;
		if (!locals.user) {
			return fail(401, { message: 'Connectez-vous pour poser une question.' });
		}

		const { productQnaEnabled } = await getStoreFeatureFlags();
		if (!productQnaEnabled) {
			return fail(404, { message: 'Les questions produit ne sont pas disponibles.' });
		}

		const askForm = await superValidate(event.request, zod(askQuestionSchema));
		if (!askForm.valid) {
			return fail(400, { askForm });
		}

		const product = await getProductBySlug(params.slug!);
		if (!product) {
			error(404, 'Produit introuvable');
		}

		try {
			await askQuestion({
				productId: product.id,
				userId: locals.user.id,
				question: askForm.data.question
			});
			return message(
				askForm,
				"Question envoyée — elle sera publiée une fois répondue par l'équipe."
			);
		} catch (err) {
			console.error('Error creating product question:', err);
			return fail(500, { askForm, message: "La question n'a pas pu être enregistrée." });
		}
	}
};
