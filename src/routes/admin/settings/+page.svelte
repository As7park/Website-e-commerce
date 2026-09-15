<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import { Switch } from '$shadcn/switch';
	import { Label } from '$shadcn/label';
	import { toast } from 'svelte-sonner';

	let { data, form } = $props();

	type FlagKey =
		| 'wishlistEnabled'
		| 'crossSellEnabled'
		| 'returnsEnabled'
		| 'savedPaymentsEnabled'
		| 'loyaltyEnabled';

	const MODULES: { key: FlagKey; label: string; description: string }[] = [
		{
			key: 'wishlistEnabled',
			label: 'Liste d’envies',
			description:
				'Un cœur sur chaque fiche produit pour enregistrer un article à retrouver plus tard, visible depuis le compte client.'
		},
		{
			key: 'crossSellEnabled',
			label: 'Ventes croisées',
			description:
				'Bloc « Vous aimerez aussi » sur la fiche produit, basé sur la catégorie de l’article consulté.'
		},
		{
			key: 'returnsEnabled',
			label: 'Espace retour / SAV',
			description:
				'Permet à un client de déclarer un retour depuis l’historique de ses commandes plutôt que par le formulaire de contact générique.'
		},
		{
			key: 'savedPaymentsEnabled',
			label: 'Moyen de paiement enregistré',
			description:
				'Carte Stripe mémorisée pour accélérer un prochain achat, sans ressaisie au tunnel de commande.'
		},
		{
			key: 'loyaltyEnabled',
			label: 'Palier de fidélité',
			description:
				'Code promo automatique après un nombre de commandes payées, sur le moteur de codes promo déjà existant.'
		}
	];

	let flags = $state({ ...data.flags });
	let formEl: HTMLFormElement;
	let pending = $state(false);

	// Chaque bascule soumet directement le formulaire complet, sans bouton.
	async function toggleFlag(key: FlagKey, checked: boolean) {
		flags[key] = checked;
		await tick();
		formEl.requestSubmit();
	}

	$effect(() => {
		if (form?.success) toast.success('Modules mis à jour');
		else if (form?.message) toast.error(form.message);
	});
</script>

<svelte:head>
	<title>Modules e-commerce — Admin</title>
</svelte:head>

<div class="px-6 space-y-6 max-w-2xl">
	<div>
		<h1 class="text-2xl font-semibold">Modules e-commerce</h1>
		<p class="text-sm text-muted-foreground">
			Un module désactivé n’apparaît nulle part côté boutique — pas seulement masqué, ses routes
			restent fermées.
		</p>
	</div>

	<form
		method="POST"
		bind:this={formEl}
		use:enhance={() => {
			pending = true;
			return async ({ update }) => {
				pending = false;
				await update();
			};
		}}
		class="space-y-4"
	>
		{#each MODULES as { key, label, description } (key)}
			<div class="flex items-start justify-between gap-4 rounded-lg border p-4">
				<div class="space-y-1">
					<Label for={key} class="text-base font-medium">{label}</Label>
					<p class="text-sm text-muted-foreground">{description}</p>
				</div>
				<input type="hidden" name={key} value={flags[key] ? 'on' : 'off'} />
				<Switch
					id={key}
					checked={flags[key]}
					disabled={pending}
					onCheckedChange={(checked) => toggleFlag(key, checked)}
				/>
			</div>
		{/each}
	</form>
</div>
