<script lang="ts">
	// Solde décroissant, distinct du code promo (`PromoCodeInput.svelte`) :
	// les deux se cumulent, le solde de la carte s'appliquant sur ce qu'il
	// reste à payer une fois la remise promo déduite (`maxApplicable`).
	import * as Card from '$shadcn/card/index.js';
	import { Input } from '$shadcn/input';
	import { Button } from '$shadcn/button';
	import { Gift, X } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		maxApplicable: number;
		appliedCode: string;
		appliedAmount: number;
		onApplied: (code: string, amount: number) => void;
		onRemoved: () => void;
	}

	let { maxApplicable, appliedCode, appliedAmount, onApplied, onRemoved }: Props = $props();

	let codeInput = $state('');
	let loading = $state(false);

	async function applyCode() {
		const code = codeInput.trim();
		if (!code) {
			toast.error('Veuillez saisir un code de carte cadeau.');
			return;
		}

		try {
			loading = true;
			const res = await fetch('/api/gift-cards/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code, maxApplicable })
			});
			const result = await res.json();

			if (result.valid) {
				onApplied(result.code ?? code.toUpperCase(), result.amount);
				toast.success(`Carte cadeau appliquée : -${result.amount.toFixed(2)}€`);
				codeInput = '';
			} else {
				toast.error(result.reason || 'Carte cadeau invalide.');
			}
		} catch (err) {
			console.error('Erreur validation carte cadeau:', err);
			toast.error('Impossible de vérifier la carte cadeau.');
		} finally {
			loading = false;
		}
	}

	function removeCode() {
		onRemoved();
		toast.success('Carte cadeau retirée.');
	}
</script>

<Card.Root>
	<div class="p-6 flex flex-col space-y-1.5">
		<h3 class="text-2xl font-semibold leading-none tracking-tight flex items-center gap-2">
			<Gift class="w-5 h-5" />
			Carte cadeau
		</h3>
	</div>
	<div class="p-6 pt-0">
		{#if appliedCode && appliedAmount > 0}
			<div class="flex items-center justify-between rounded-lg border p-4 bg-muted/50">
				<div>
					<p class="font-medium">{appliedCode}</p>
					<p class="text-sm text-muted-foreground">Utilisé : {appliedAmount.toFixed(2)}€</p>
				</div>
				<button
					type="button"
					onclick={removeCode}
					class="text-destructive hover:text-destructive/80"
					aria-label="Retirer la carte cadeau"
				>
					<X class="w-5 h-5" />
				</button>
			</div>
		{:else}
			<div class="flex gap-2">
				<Input
					type="text"
					placeholder="GIFT-XXXX-XXXX-XXXX"
					bind:value={codeInput}
					onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && (e.preventDefault(), applyCode())}
				/>
				<Button type="button" onclick={applyCode} disabled={loading}>
					{loading ? '...' : 'Appliquer'}
				</Button>
			</div>
		{/if}
	</div>
</Card.Root>
