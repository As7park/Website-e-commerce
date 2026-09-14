<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$shadcn/button';

	let { form } = $props();
</script>

<svelte:head>
	<title>Exports — Admin</title>
</svelte:head>

<div class="px-6 space-y-6 max-w-xl">
	<div>
		<h1 class="text-2xl font-semibold">Exports CSV</h1>
		<p class="text-sm text-muted-foreground">
			Génère un export complet (ventes ou utilisateurs) en tâche de fond. Un e-mail avec un lien de
			téléchargement (valable 24h) vous sera envoyé quand le fichier sera prêt.
		</p>
	</div>

	{#if form?.success}
		<p class="text-sm text-green-600">
			Export {form.kind === 'sales' ? 'des ventes' : 'des utilisateurs'} lancé — vous recevrez un e-mail
			sous peu.
		</p>
	{/if}
	{#if form?.message}
		<p class="text-sm text-red-600">{form.message}</p>
	{/if}

	<div class="flex gap-4">
		<form method="POST" action="?/sales" use:enhance>
			<Button type="submit">Exporter les ventes</Button>
		</form>
		<form method="POST" action="?/users" use:enhance>
			<Button type="submit">Exporter les utilisateurs</Button>
		</form>
	</div>
</div>
