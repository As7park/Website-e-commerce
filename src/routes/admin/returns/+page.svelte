<script lang="ts">
	import * as Card from '$shadcn/card';
	import { buttonVariants } from '$shadcn/button';
	import * as AlertDialog from '$shadcn/alert-dialog/index.js';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { cn } from '$lib/components/shadcn/utils.js';
	import { formatDate } from '$lib/utils/formatDate';
	import { formatMoney } from '$lib/utils/formatMoney';

	let { data } = $props();

	const STATUS_LABELS: Record<string, string> = {
		REQUESTED: 'En attente',
		APPROVED: 'Approuvée',
		REJECTED: 'Refusée',
		REFUNDED: 'Remboursée',
		CREDITED: 'Créditée'
	};
</script>

<svelte:head>
	<title>Retours — Admin</title>
</svelte:head>

<h1 class="m-5 text-4xl">Demandes de retour</h1>

<div class="ccc w-[100%]">
	<div class="w-full max-w-[960px] space-y-4">
		{#if data.returnRequests.length === 0}
			<p class="text-muted-foreground">Aucune demande de retour pour l'instant.</p>
		{/if}

		{#each data.returnRequests as item (item.id)}
			<Card.Root>
				<Card.Content
					class="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
				>
					<div>
						<p class="font-medium">
							{item.transaction.invoiceNumber ?? item.transactionId} — {formatMoney(
								item.transaction.amount
							)}
						</p>
						<p class="text-sm text-muted-foreground">{item.user.email}</p>
						<p class="mt-1 text-sm">Motif : {item.reason}</p>
						<p class="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
					</div>
					<div class="flex items-center gap-2">
						{#if item.status === 'REQUESTED'}
							<AlertDialog.Root>
								<AlertDialog.Trigger
									class={cn(buttonVariants({ variant: 'destructive', size: 'sm' }))}
								>
									Refuser
								</AlertDialog.Trigger>
								<AlertDialog.Content>
									<AlertDialog.Header>
										<AlertDialog.Title>Refuser cette demande de retour ?</AlertDialog.Title>
										<AlertDialog.Description>
											Aucun remboursement ne sera émis. Cette action est définitive.
										</AlertDialog.Description>
									</AlertDialog.Header>
									<AlertDialog.Footer>
										<AlertDialog.Cancel>Annuler</AlertDialog.Cancel>
										<form
											method="POST"
											action="?/reject"
											use:enhance={() => {
												return async ({ update, result }) => {
													await update();
													if (result.type === 'failure') {
														toast.error(String(result.data?.message ?? 'Échec'));
													}
												};
											}}
										>
											<input type="hidden" name="id" value={item.id} />
											<AlertDialog.Action type="submit">Confirmer le refus</AlertDialog.Action>
										</form>
									</AlertDialog.Footer>
								</AlertDialog.Content>
							</AlertDialog.Root>

							<AlertDialog.Root>
								<AlertDialog.Trigger class={cn(buttonVariants({ size: 'sm' }))}>
									Approuver + rembourser
								</AlertDialog.Trigger>
								<AlertDialog.Content>
									<AlertDialog.Header>
										<AlertDialog.Title>Approuver et rembourser cette commande ?</AlertDialog.Title>
										<AlertDialog.Description>
											Un remboursement Stripe intégral de {formatMoney(item.transaction.amount)} sera
											émis immédiatement sur le moyen de paiement d'origine.
										</AlertDialog.Description>
									</AlertDialog.Header>
									<AlertDialog.Footer>
										<AlertDialog.Cancel>Annuler</AlertDialog.Cancel>
										<form
											method="POST"
											action="?/approve"
											use:enhance={() => {
												return async ({ update, result }) => {
													await update();
													if (result.type === 'failure') {
														toast.error(String(result.data?.message ?? 'Échec'));
													} else {
														toast.success('Remboursement émis');
													}
												};
											}}
										>
											<input type="hidden" name="id" value={item.id} />
											<AlertDialog.Action type="submit"
												>Confirmer le remboursement</AlertDialog.Action
											>
										</form>
									</AlertDialog.Footer>
								</AlertDialog.Content>
							</AlertDialog.Root>

							{#if data.giftCardsEnabled}
								<AlertDialog.Root>
									<AlertDialog.Trigger
										class={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
									>
										Créditer le compte
									</AlertDialog.Trigger>
									<AlertDialog.Content>
										<AlertDialog.Header>
											<AlertDialog.Title
												>Créditer le compte au lieu de rembourser ?</AlertDialog.Title
											>
											<AlertDialog.Description>
												Une carte cadeau de {formatMoney(item.transaction.amount)} sera émise et envoyée
												par e-mail au client — aucun remboursement Stripe ne sera effectué.
											</AlertDialog.Description>
										</AlertDialog.Header>
										<AlertDialog.Footer>
											<AlertDialog.Cancel>Annuler</AlertDialog.Cancel>
											<form
												method="POST"
												action="?/creditStore"
												use:enhance={() => {
													return async ({ update, result }) => {
														await update();
														if (result.type === 'failure') {
															toast.error(String(result.data?.message ?? 'Échec'));
														} else {
															toast.success('Compte crédité');
														}
													};
												}}
											>
												<input type="hidden" name="id" value={item.id} />
												<AlertDialog.Action type="submit">Confirmer le crédit</AlertDialog.Action>
											</form>
										</AlertDialog.Footer>
									</AlertDialog.Content>
								</AlertDialog.Root>
							{/if}
						{:else}
							<div class="text-right">
								<span class="text-sm font-medium">{STATUS_LABELS[item.status] ?? item.status}</span>
								{#if item.creditNoteNumber}
									<p class="text-xs text-muted-foreground">Avoir : {item.creditNoteNumber}</p>
								{/if}
								{#if item.returnTrackingNumber}
									<p class="text-xs text-muted-foreground">
										Étiquette : {item.returnTrackingNumber}
									</p>
								{/if}
							</div>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
</div>
