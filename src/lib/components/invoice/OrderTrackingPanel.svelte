<script lang="ts">
	import * as Card from '$shadcn/card';
	import { Badge } from '$shadcn/badge';
	import { Button } from '$shadcn/button';
	import { formatOrderStatus } from '$lib/utils/formatOrderStatus';
	import Truck from 'lucide-svelte/icons/truck';
	import Package from 'lucide-svelte/icons/package';
	import MapPin from 'lucide-svelte/icons/map-pin';
	import ExternalLink from 'lucide-svelte/icons/external-link';

	let {
		status,
		shippingMethodName,
		trackingNumber,
		trackingUrl,
		servicePointId
	}: {
		status: string;
		shippingMethodName: string;
		trackingNumber: string | null;
		trackingUrl: string | null;
		servicePointId: string | null;
	} = $props();

	const statusLabel = $derived(formatOrderStatus(status));
	const badgeVariant = $derived(
		statusLabel.tone === 'success' ? 'default' : statusLabel.tone === 'pending' ? 'secondary' : 'outline'
	);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Truck class="size-4" />
			Suivi de commande
		</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-4 text-sm">
		<div class="flex flex-wrap items-center gap-3">
			<Badge variant={badgeVariant}>{statusLabel.label}</Badge>
			{#if shippingMethodName}
				<span class="text-muted-foreground flex items-center gap-1.5">
					<Package class="size-3.5" />
					{shippingMethodName}
				</span>
			{/if}
			{#if servicePointId}
				<span class="text-muted-foreground flex items-center gap-1.5">
					<MapPin class="size-3.5" />
					Livraison en point relais
				</span>
			{/if}
		</div>

		{#if trackingNumber}
			<div class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
				<div>
					<p class="text-muted-foreground text-xs">Numéro de suivi</p>
					<p class="font-mono text-sm">{trackingNumber}</p>
				</div>
				{#if trackingUrl}
					<Button href={trackingUrl} target="_blank" rel="noopener noreferrer" size="sm">
						Suivre le colis
						<ExternalLink class="ml-2 size-3.5" />
					</Button>
				{/if}
			</div>
		{:else if statusLabel.tone === 'success'}
			<p class="text-muted-foreground">
				Votre colis n'a pas encore été pris en charge par le transporteur — le numéro de suivi
				apparaîtra ici dès qu'il sera disponible.
			</p>
		{/if}
	</Card.Content>
</Card.Root>
