<script lang="ts">
	import * as Card from '$shadcn/card';
	import { Button } from '$shadcn/button';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { loadStripe, type Stripe, type StripeCardElement } from '@stripe/stripe-js';
	import CreditCard from 'lucide-svelte/icons/credit-card';
	import Trash from 'lucide-svelte/icons/trash';
	import Star from 'lucide-svelte/icons/star';

	let { data } = $props();

	let stripe: Stripe | null = $state(null);
	let cardElement: StripeCardElement | null = null;
	let cardElementDiv: HTMLDivElement;
	let cardError = $state('');
	let submitting = $state(false);

	$effect(() => {
		(async () => {
			stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
			if (stripe && cardElementDiv) {
				const elements = stripe.elements();
				cardElement = elements.create('card');
				cardElement.mount(cardElementDiv);
				cardElement.on('change', (event) => {
					cardError = event.error ? event.error.message : '';
				});
			}
		})();

		return () => {
			cardElement?.unmount();
		};
	});

	async function addCard(event: SubmitEvent) {
		event.preventDefault();
		if (!stripe || !cardElement) return;

		submitting = true;
		try {
			const res = await fetch('/auth/settings/saved-payments/setup-intent', { method: 'POST' });
			if (!res.ok) {
				toast.error("Impossible de préparer l'ajout de carte");
				return;
			}
			const { clientSecret } = await res.json();

			const result = await stripe.confirmCardSetup(clientSecret, {
				payment_method: { card: cardElement }
			});

			if (result.error) {
				cardError = result.error.message ?? 'Carte refusée';
				return;
			}

			const paymentMethodId = result.setupIntent?.payment_method;
			if (!paymentMethodId || typeof paymentMethodId !== 'string') {
				toast.error("Échec de l'enregistrement de la carte");
				return;
			}

			const formData = new FormData();
			formData.set('paymentMethodId', paymentMethodId);
			const attachRes = await fetch('?/attach', { method: 'POST', body: formData });
			if (attachRes.ok) {
				toast.success('Carte enregistrée');
				cardElement.clear();
				await invalidateAll();
			} else {
				toast.error("Échec de l'enregistrement de la carte");
			}
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Mes moyens de paiement</title>
</svelte:head>

<div class="mx-auto max-w-[720px] px-6 pt-10 pb-12">
	<p class="mb-6">
		<a href="/auth/settings" class="text-foreground">← Mon compte</a>
	</p>
	<h1 class="mb-6 text-2xl font-semibold">Mes moyens de paiement</h1>

	{#if data.paymentMethods.length === 0}
		<p class="mb-6 text-muted-foreground">Aucune carte enregistrée pour l'instant.</p>
	{:else}
		<div class="mb-8 space-y-3">
			{#each data.paymentMethods as method (method.id)}
				<Card.Root>
					<Card.Content class="flex items-center justify-between gap-4 p-4">
						<div class="flex items-center gap-3">
							<CreditCard class="size-5 text-primary" />
							<div>
								<p class="font-medium capitalize">
									{method.brand} •••• {method.last4}
									{#if method.isDefault}
										<span class="ml-2 text-xs text-muted-foreground">(par défaut)</span>
									{/if}
								</p>
								<p class="text-sm text-muted-foreground">
									Expire {String(method.expMonth).padStart(2, '0')}/{method.expYear}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-2">
							{#if !method.isDefault}
								<form
									method="POST"
									action="?/setDefault"
									use:enhance={() => {
										return async ({ update }) => {
											await update();
										};
									}}
								>
									<input type="hidden" name="id" value={method.id} />
									<Button
										type="submit"
										variant="outline"
										size="sm"
										title="Définir par défaut"
										aria-label="Définir par défaut"
									>
										<Star class="size-4" />
									</Button>
								</form>
							{/if}
							<form
								method="POST"
								action="?/delete"
								use:enhance={() => {
									return async ({ update }) => {
										await update();
									};
								}}
							>
								<input type="hidden" name="id" value={method.id} />
								<Button
									type="submit"
									variant="outline"
									size="sm"
									title="Supprimer"
									aria-label="Supprimer ce moyen de paiement"
								>
									<Trash class="size-4" />
								</Button>
							</form>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>Ajouter une carte</Card.Title>
		</Card.Header>
		<form onsubmit={addCard}>
			<Card.Content class="space-y-3">
				<div bind:this={cardElementDiv} class="rounded-md border p-3"></div>
				{#if cardError}
					<p class="text-sm text-destructive">{cardError}</p>
				{/if}
			</Card.Content>
			<Card.Footer>
				<Button type="submit" disabled={submitting} class="w-full">
					{submitting ? 'Enregistrement…' : 'Enregistrer la carte'}
				</Button>
			</Card.Footer>
		</form>
	</Card.Root>
</div>
