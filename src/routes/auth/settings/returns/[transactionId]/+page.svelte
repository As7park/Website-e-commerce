<script lang="ts">
	import * as Card from '$shadcn/card';
	import { Button } from '$shadcn/button';
	import { Textarea } from '$shadcn/textarea';
	import * as RadioGroup from '$shadcn/radio-group/index.js';
	import { Label } from '$shadcn/label';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { formatMoney } from '$lib/utils/formatMoney';
	import { formatDate } from '$lib/utils/formatDate';

	let { data, form } = $props();

	const STATUS_LABELS: Record<string, string> = {
		REQUESTED: 'En attente de traitement',
		APPROVED: 'Approuvée',
		REJECTED: 'Refusée',
		REFUNDED: 'Remboursée',
		CREDITED: 'Créditée'
	};

	const KIND_LABELS: Record<string, string> = {
		WITHDRAWAL: 'Rétractation (14 jours)',
		WARRANTY: 'Retour SAV / garantie'
	};

	// Dérivé plutôt qu'un `$state` posé par effet : se réinitialise seul à
	// chaque changement de commande (navigation entre deux `[transactionId]`,
	// même instance de composant réutilisée par SvelteKit).
	// `kindOverride` capture uniquement un choix explicite de l'utilisateur ;
	// une nouvelle commande (id différent) l'ignore et repart de la valeur
	// par défaut.
	let kindOverride = $state<{ id: string; kind: 'WITHDRAWAL' | 'WARRANTY' } | null>(null);
	let kind = $derived(
		kindOverride?.id === data.transaction.id
			? kindOverride.kind
			: data.withdrawalEligible
				? 'WITHDRAWAL'
				: 'WARRANTY'
	);
	function setKind(value: 'WITHDRAWAL' | 'WARRANTY') {
		kindOverride = { id: data.transaction.id, kind: value };
	}

	$effect(() => {
		if (form?.message) {
			toast.error(form.message);
		}
	});
</script>

<svelte:head>
	<title>Demande de retour</title>
</svelte:head>

<p class="mb-4 text-sm"><a href="/auth/settings/factures" class="shop-link">← Mes factures</a></p>
<header class="shop-page-head">
	<h1 class="shop-page-title">Demande de retour</h1>
</header>

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
			<p class="mt-1 text-sm text-muted-foreground">
				Type : {KIND_LABELS[data.returnRequest.kind] ?? data.returnRequest.kind}
			</p>
			<p class="mt-2 text-sm text-muted-foreground">Motif : {data.returnRequest.reason}</p>
			{#if data.returnRequest.status === 'REFUNDED'}
				<p class="mt-2 text-sm text-muted-foreground">
					Le remboursement a été émis auprès de votre moyen de paiement.
				</p>
			{:else if data.returnRequest.status === 'CREDITED'}
				<p class="mt-2 text-sm text-muted-foreground">
					Un avoir a été crédité sur votre compte, sous forme de carte cadeau — le code vous a été
					envoyé par e-mail.
				</p>
			{/if}
			{#if data.returnRequest.creditNoteNumber}
				<div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
					<div>
						<p class="text-xs text-muted-foreground">Avoir</p>
						<p class="font-mono text-sm">{data.returnRequest.creditNoteNumber}</p>
					</div>
					<Button href="/auth/settings/returns/{data.transaction.id}/avoir" size="sm">
						Télécharger l'avoir
					</Button>
				</div>
			{/if}
			{#if data.returnRequest.returnTrackingNumber}
				<div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
					<div>
						<p class="text-xs text-muted-foreground">Étiquette de retour — numéro de suivi</p>
						<p class="font-mono text-sm">{data.returnRequest.returnTrackingNumber}</p>
					</div>
					{#if data.returnRequest.returnTrackingUrl}
						<Button
							href={data.returnRequest.returnTrackingUrl}
							target="_blank"
							rel="noopener noreferrer"
							size="sm"
						>
							Télécharger l'étiquette
						</Button>
					{/if}
				</div>
			{:else if data.returnRequest.status === 'REFUNDED' || data.returnRequest.status === 'CREDITED'}
				<p class="mt-2 text-sm text-muted-foreground">
					L'étiquette de retour n'est pas encore disponible — contactez-nous si elle tarde à
					apparaître.
				</p>
			{/if}
		</Card.Content>
	</Card.Root>
{:else}
	<Card.Root>
		<Card.Header>
			<Card.Title>Motif du retour</Card.Title>
			<Card.Description>
				Une fois votre demande approuvée, le remboursement est émis automatiquement sur le moyen de
				paiement utilisé.
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
			<Card.Content class="space-y-4">
				{#if data.withdrawalEligible}
					<RadioGroup.Root
						name="kind"
						value={kind}
						onValueChange={(value) => setKind(value as 'WITHDRAWAL' | 'WARRANTY')}
						class="space-y-2"
					>
						<div class="flex items-start space-x-2">
							<RadioGroup.Item value="WITHDRAWAL" id="kind-withdrawal" class="mt-1" />
							<Label for="kind-withdrawal" class="font-normal">
								<span class="font-medium">Rétractation (14 jours, sans motif)</span><br />
								<span class="text-sm text-muted-foreground">
									Vous disposez de 14 jours à compter de la réception de votre commande pour vous
									rétracter sans avoir à justifier de motif — remboursement intégral, frais de
									livraison standard inclus.
								</span>
							</Label>
						</div>
						<div class="flex items-start space-x-2">
							<RadioGroup.Item value="WARRANTY" id="kind-warranty" class="mt-1" />
							<Label for="kind-warranty" class="font-normal">
								<span class="font-medium">Retour SAV / garantie</span><br />
								<span class="text-sm text-muted-foreground">
									Produit défectueux ou non conforme, au-delà du délai de rétractation.
								</span>
							</Label>
						</div>
					</RadioGroup.Root>
					{#if kind === 'WITHDRAWAL'}
						<p class="text-xs text-muted-foreground">
							Commande expédiée le {formatDate(String(data.estimatedShippedAt))} (estimation) — le délai
							légal de 14 jours court à partir de la réception réelle du colis, pas de cette date. Il
							expire donc au plus tôt vers le {formatDate(
								String(data.estimatedWithdrawalDeadline)
							)}.
						</p>
					{/if}
				{:else}
					<input type="hidden" name="kind" value="WARRANTY" />
					<p class="text-sm text-muted-foreground">
						Cette commande a été confectionnée sur mesure (gravure, personnalisation) : elle est
						exclue du droit de rétractation légal (article L221-28 du Code de la consommation). Un
						retour reste possible au titre de la garantie légale de conformité.
					</p>
				{/if}
				<Textarea
					name="reason"
					placeholder={kind === 'WITHDRAWAL'
						? 'Motif facultatif pour une rétractation'
						: 'Expliquez la raison du retour'}
					required={kind === 'WARRANTY'}
					rows={4}
				/>
			</Card.Content>
			<Card.Footer>
				<Button type="submit" class="w-full">Envoyer la demande</Button>
			</Card.Footer>
		</form>
	</Card.Root>
{/if}
