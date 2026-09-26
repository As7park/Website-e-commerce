<script lang="ts">
	import * as Card from '$shadcn/card';
	import { Button, buttonVariants } from '$shadcn/button';
	import { Input } from '$shadcn/input';
	import { Label } from '$shadcn/label';
	import * as AlertDialog from '$shadcn/alert-dialog/index.js';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { cn } from '$lib/components/shadcn/utils.js';

	let { data, form } = $props();

	$effect(() => {
		if (form?.message) {
			toast.error(form.message);
		}
	});
</script>

<svelte:head>
	<title>Mes données</title>
</svelte:head>

<header class="shop-page-head">
	<h1 class="shop-page-title">Mes données</h1>
</header>

<Card.Root class="mb-6">
	<Card.Header>
		<Card.Title>Exporter mes données</Card.Title>
		<Card.Description>
			Téléchargez un fichier JSON contenant vos données personnelles : profil, adresses, commandes,
			factures, avis, questions produit, liste d'envies, retours (droit à la portabilité, RGPD art.
			20).
		</Card.Description>
	</Card.Header>
	<Card.Footer>
		<Button href="/auth/settings/donnees/export" class="w-full">Télécharger mes données</Button>
	</Card.Footer>
</Card.Root>

<Card.Root class="border-destructive/40">
	<Card.Header>
		<Card.Title>Supprimer mon compte</Card.Title>
		<Card.Description>
			Votre profil est anonymisé immédiatement (email, nom, mot de passe, adresses, liste d'envies
			supprimés) et vous êtes déconnecté de partout. Vos commandes et factures restent conservées,
			comme l'exige la loi (obligation comptable), mais ne sont plus rattachées à des informations
			vous identifiant.
		</Card.Description>
	</Card.Header>
	<Card.Footer>
		<AlertDialog.Root>
			<AlertDialog.Trigger class={cn(buttonVariants({ variant: 'destructive' }), 'w-full')}>
				Supprimer mon compte
			</AlertDialog.Trigger>
			<AlertDialog.Content>
				<AlertDialog.Header>
					<AlertDialog.Title>Confirmer la suppression du compte</AlertDialog.Title>
					<AlertDialog.Description>
						Cette action est immédiate et irréversible pour votre profil.
					</AlertDialog.Description>
				</AlertDialog.Header>
				<form
					method="POST"
					action="?/delete"
					use:enhance={() => {
						return async ({ update, result }) => {
							await update();
							if (result.type === 'failure') {
								toast.error(String(result.data?.message ?? 'Échec'));
							}
						};
					}}
				>
					{#if data.hasPassword}
						<Label for="password">Mot de passe actuel</Label>
						<Input id="password" name="password" type="password" required class="mt-1" />
					{:else}
						<Label for="confirmText">Saisissez « SUPPRIMER » pour confirmer</Label>
						<Input id="confirmText" name="confirmText" type="text" required class="mt-1" />
					{/if}
					<AlertDialog.Footer class="mt-4">
						<AlertDialog.Cancel>Annuler</AlertDialog.Cancel>
						<AlertDialog.Action type="submit">Confirmer la suppression</AlertDialog.Action>
					</AlertDialog.Footer>
				</form>
			</AlertDialog.Content>
		</AlertDialog.Root>
	</Card.Footer>
</Card.Root>
