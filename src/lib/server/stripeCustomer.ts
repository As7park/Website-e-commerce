/**
 * Client Stripe associé à un compte (`User.stripeCustomerId`).
 *
 * COMMERCE-PLUGIN : créé paresseusement au premier ajout d'une carte
 * enregistrée (`savedPaymentsEnabled`), jamais au checkout simple — un
 * visiteur qui paie sans enregistrer sa carte ne génère aucun `Customer`
 * Stripe. Une fois créé, `createCheckoutSession` (`$lib/commerce/checkout.ts`)
 * le réutilise pour que Stripe Checkout propose nativement les cartes déjà
 * enregistrées, sans UI supplémentaire à construire côté tunnel.
 */
import { prisma } from '$lib/server';
import { stripe } from '$lib/server/stripe';

export async function ensureStripeCustomer(userId: string): Promise<string> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, email: true, stripeCustomerId: true }
	});
	if (!user) {
		throw new Error(`Utilisateur introuvable: ${userId}`);
	}
	if (user.stripeCustomerId) {
		return user.stripeCustomerId;
	}

	const customer = await stripe.customers.create({
		email: user.email,
		metadata: { user_id: user.id }
	});

	await prisma.user.update({
		where: { id: userId },
		data: { stripeCustomerId: customer.id }
	});

	return customer.id;
}
