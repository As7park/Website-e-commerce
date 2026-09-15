<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Card from '$shadcn/card';
	import { Input } from '$shadcn/input';
	import { Label } from '$shadcn/label';
	import { Button } from '$shadcn/button';
	import OrderTrackingPanel from '$lib/components/invoice/OrderTrackingPanel.svelte';

	let { form } = $props();
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Suivi de commande</title>
</svelte:head>

<div class="mx-auto max-w-[560px] px-6 pt-16 pb-12">
	<h1 class="mb-2 text-2xl font-semibold">Suivi de commande</h1>
	<p class="mb-8 text-muted-foreground">
		Retrouvez le statut de votre commande sans vous connecter, avec votre numéro de facture et
		l'email utilisé lors de l'achat.
	</p>

	<Card.Root>
		<Card.Content class="pt-6">
			<form
				method="POST"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
				class="space-y-4"
			>
				<div class="space-y-2">
					<Label for="invoiceNumber">Numéro de facture</Label>
					<Input id="invoiceNumber" name="invoiceNumber" placeholder="FAC-2026-00042" required />
				</div>
				<div class="space-y-2">
					<Label for="email">Email utilisé lors de l'achat</Label>
					<Input id="email" name="email" type="email" required />
				</div>
				<Button type="submit" class="w-full" disabled={submitting}>
					{submitting ? 'Recherche…' : 'Suivre ma commande'}
				</Button>
			</form>

			{#if form?.message}
				<p class="mt-4 text-sm text-destructive">{form.message}</p>
			{/if}
		</Card.Content>
	</Card.Root>

	{#if form?.success && form.tracking}
		<div class="mt-6">
			<p class="mb-3 text-sm text-muted-foreground">
				Facture {form.tracking.invoiceNumber}
			</p>
			<OrderTrackingPanel
				status={form.tracking.status}
				shippingMethodName={form.tracking.shippingMethodName}
				trackingNumber={form.tracking.trackingNumber}
				trackingUrl={form.tracking.trackingUrl}
				servicePointId={form.tracking.servicePointId}
			/>
		</div>
	{/if}
</div>
