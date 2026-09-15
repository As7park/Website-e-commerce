<script lang="ts">
	import * as Card from '$shadcn/card';
	import { Button } from '$shadcn/button';
	import { Textarea } from '$shadcn/textarea';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { formatMoney } from '$lib/utils/formatMoney';

	let { data, form } = $props();

	const STATUS_LABELS: Record<string, string> = {
		REQUESTED: 'En attente de traitement',
		APPROVED: 'Approuvée',
		REJECTED: 'Refusée',
		REFUNDED: 'Remboursée'
	};

	$effect(() => {
		if (form?.message) {
			toast.error(form.message);
		}
	});
</script>

<svelte:head>
	<title>Demande de retour</title>
</svelte:head>

<div class="mx-auto max-w-[640px] px-6 pt-10 pb-12">
	<p class="mb-6">
		<a href="/auth/settings/factures" class="text-foreground">← Mes factures</a>
	</p>
	<h1 class="mb-6 text-2xl font-semibold">Demande de retour</h1>

	<Card.Root class="mb-6">
		<Card.Content class="p-4">
			<p><strong>Facture :</strong> {data.transaction.invoiceNumber ?? data.transaction.id}</p>
			<p><strong>Montant :</strong> {formatMoney(data.transaction.amount)}</p>
		</Card.Content>
	</Card.Root>

	{#if data.returnRequest}
		<Card.Root>
			<Card.Header>
				<Card.Title>Statut de votre demande</Card.Title>
			</Card.Header>
			<Card.Content>
				<p class="font-medium">
					{STATUS_LABELS[data.returnRequest.status] ?? data.returnRequest.status}
				</p>
				<p class="mt-2 text-sm text-muted-foreground">Motif : {data.returnRequest.reason}</p>
				{#if data.returnRequest.status === 'REFUNDED'}
					<p class="mt-2 text-sm text-muted-foreground">
						Le remboursement a été émis auprès de votre moyen de paiement.
					</p>
				{/if}
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>Motif du retour</Card.Title>
				<Card.Description>
					Une fois votre demande approuvée, le remboursement est émis automatiquement sur le moyen
					de paiement utilisé.
				</Card.Description>
			</Card.Header>
			<form
				method="POST"
				action="?/request"
				use:enhance={() => {
					return async ({ update, result }) => {
						await update();
						if (result.type === 'success') {
							toast.success('Votre demande de retour a été envoyée');
						}
					};
				}}
			>
				<Card.Content>
					<Textarea name="reason" placeholder="Expliquez la raison du retour" required rows={4} />
				</Card.Content>
				<Card.Footer>
					<Button type="submit" class="w-full">Envoyer la demande</Button>
				</Card.Footer>
			</form>
		</Card.Root>
	{/if}
</div>
