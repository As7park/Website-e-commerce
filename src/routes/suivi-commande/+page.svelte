<script lang="ts">
	import { enhance } from '$app/forms';
	import ShopPage from '$lib/components/shop/ShopPage.svelte';
	import { Input } from '$shadcn/input';
	import { Label } from '$shadcn/label';
	import { Button } from '$shadcn/button';
	import OrderTrackingPanel from '$lib/components/invoice/OrderTrackingPanel.svelte';
	import SEO from '$lib/components/SEO.svelte';

	let { form } = $props();
	let submitting = $state(false);
</script>

<!-- Formulaire de recherche par n° de commande : aucune valeur SEO, et
     potentiellement des données de commande une fois soumis. -->
<SEO
	title="Suivi de commande"
	description="Suivez votre commande MadeInDiamonds."
	noindex
	nofollow
/>

<ShopPage
	title="Suivi de commande"
	lead="Retrouvez le statut de votre commande sans vous connecter, avec votre numéro de facture et l'e-mail utilisé lors de l'achat."
	crumbs={[{ label: 'Suivi de commande' }]}
	width="text"
>
	<div class="shop-panel">
		<div>
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
		</div>
	</div>

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
				shippingStatusMessage={form.tracking.shippingStatusMessage}
			/>
		</div>
	{/if}
</ShopPage>
