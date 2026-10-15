<script lang="ts">
	import { untrack } from 'svelte';
	import * as Form from '$shadcn/form';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import { Checkbox } from '$shadcn/checkbox/index.js';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { RETRY_FRIENDLY_FORM } from '$lib/forms/superformOptions';
	import { updatePromoSchema } from '$lib/schema/promo/promoSchema.js';
	import { goto } from '$app/navigation';

	let { data } = $props();

	const updatePromo = superForm(
		untrack(() => data.updatePromoForm),
		{
			validators: zodClient(updatePromoSchema),
			id: 'updatePromo',
			...RETRY_FRIENDLY_FORM
		}
	);

	const {
		form: updatePromoData,
		enhance: updatePromoEnhance,
		message: updatePromoMessage
	} = updatePromo;

	$effect(() => {
		if ($updatePromoMessage === 'Code promo mis à jour avec succès') {
			toast.success($updatePromoMessage);
			setTimeout(() => goto('/admin/promo/'), 1000);
		} else if ($updatePromoMessage) {
			toast.error($updatePromoMessage);
		}
	});
</script>

<div class="ccc">
	<div class="m-5 p-5 border rounded-lg w-[80vw] max-w-[600px]">
		<h1 class="text-2xl font-bold mb-6">Modifier le code promo</h1>

		<form method="POST" action="?/updatePromo" use:updatePromoEnhance class="space-y-4">
			<input type="hidden" name="id" value={$updatePromoData.id} />

			<Form.Field name="code" form={updatePromo}>
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Code</Form.Label>
						<Input {...props} name="code" type="text" bind:value={$updatePromoData.code} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field name="type" form={updatePromo}>
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Type de remise</Form.Label>
						<select
							{...props}
							name="type"
							bind:value={$updatePromoData.type}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							<option value="PERCENTAGE">Pourcentage (%)</option>
							<option value="FIXED">Montant fixe (€)</option>
						</select>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field name="value" form={updatePromo}>
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>
							Valeur {$updatePromoData.type === 'PERCENTAGE' ? '(en %)' : '(en €)'}
						</Form.Label>
						<Input
							{...props}
							name="value"
							type="number"
							step="0.01"
							min="0"
							bind:value={$updatePromoData.value}
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field name="minAmount" form={updatePromo}>
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Montant minimum de commande (€, optionnel)</Form.Label>
						<Input
							{...props}
							name="minAmount"
							type="number"
							step="0.01"
							min="0"
							bind:value={$updatePromoData.minAmount}
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field name="usageLimit" form={updatePromo}>
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Limite d'utilisation (optionnel, vide = illimité)</Form.Label>
						<Input
							{...props}
							name="usageLimit"
							type="number"
							step="1"
							min="0"
							bind:value={$updatePromoData.usageLimit}
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field name="expiresAt" form={updatePromo}>
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Date d'expiration (optionnel)</Form.Label>
						<Input
							{...props}
							name="expiresAt"
							type="date"
							bind:value={$updatePromoData.expiresAt}
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			{#if data.loyaltyEnabled}
				<Form.Field name="loyaltyThreshold" form={updatePromo}>
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Seuil fidélité (optionnel)</Form.Label>
							<Input
								{...props}
								name="loyaltyThreshold"
								type="number"
								step="1"
								min="1"
								placeholder="ex: 5"
								bind:value={$updatePromoData.loyaltyThreshold}
							/>
							<p class="text-sm text-muted-foreground">
								Si renseigné, ce code est offert automatiquement au client qui atteint ce nombre de
								commandes payées.
							</p>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			{:else}
				<p class="text-sm text-muted-foreground">
					Module « Fidélité » désactivé — active-le dans <a href="/admin/settings" class="underline"
						>/admin/settings</a
					> pour définir un seuil sur ce code.
				</p>
			{/if}

			<Form.Field name="active" form={updatePromo} class="rcc">
				<Form.Control>
					{#snippet children({ props })}
						<div class="flex items-center space-x-2">
							<Checkbox
								{...props}
								name="active"
								bind:checked={$updatePromoData.active as boolean | undefined}
							/>
							<Form.Label class="text-sm font-medium leading-none">Code actif</Form.Label>
						</div>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Button type="submit">Enregistrer les modifications</Button>
		</form>
	</div>
</div>
