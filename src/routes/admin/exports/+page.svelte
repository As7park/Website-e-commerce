<script lang="ts">
	import { Button } from '$shadcn/button';

	const exports = [
		{ kind: 'sales', label: 'Ventes' },
		{ kind: 'users', label: 'Utilisateurs' },
		{ kind: 'products', label: 'Produits' },
		{ kind: 'blog', label: 'Articles de blog' },
		{ kind: 'promo', label: 'Codes promo' },
		{ kind: 'contacts', label: 'Messages de contact' }
	];
</script>

<svelte:head>
	<title>Exports — Admin</title>
</svelte:head>

<div class="px-6 space-y-6 max-w-xl">
	<div>
		<h1 class="text-2xl font-semibold">Exports CSV</h1>
		<p class="text-sm text-muted-foreground">
			Télécharge un export CSV complet du jeu de données choisi.
		</p>
	</div>

	<div class="flex flex-wrap gap-4">
		{#each exports as { kind, label } (kind)}
			<Button href="/admin/exports/{kind}">Exporter {label}</Button>
		{/each}
	</div>
</div>
