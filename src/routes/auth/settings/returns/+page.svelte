<script lang="ts">
	import * as Card from '$shadcn/card';
	import { Button } from '$shadcn/button';
	import { formatDate } from '$lib/utils/formatDate';
	import { formatMoney } from '$lib/utils/formatMoney';

	let { data } = $props();

	const STATUS_LABELS: Record<string, string> = {
		REQUESTED: 'Demande en attente',
		APPROVED: 'Approuvée',
		REJECTED: 'Refusée',
		REFUNDED: 'Remboursée',
		CREDITED: 'Créditée'
	};
</script>

<svelte:head>
	<title>Mes retours</title>
</svelte:head>

<header class="shop-page-head">
	<h1 class="shop-page-title">Mes retours</h1>
</header>

{#if data.transactions.length === 0}
	<p class="text-muted-foreground">Aucune commande éligible au retour pour le moment.</p>
{/if}

<div class="space-y-3">
	{#each data.transactions as item (item.id)}
		<Card.Root>
			<Card.Content class="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p class="font-medium">{item.invoiceNumber ?? item.id} — {formatMoney(item.amount)}</p>
					<p class="text-sm text-muted-foreground">{formatDate(item.createdAt)}</p>
					{#if item.returnStatus}
						<p class="text-sm text-muted-foreground">
							Statut : {STATUS_LABELS[item.returnStatus] ?? item.returnStatus}
						</p>
					{/if}
				</div>
				<Button href={`/auth/settings/returns/${item.id}`} variant="outline">
					{item.returnStatus ? 'Voir la demande' : 'Demander un retour'}
				</Button>
			</Card.Content>
		</Card.Root>
	{/each}
</div>
