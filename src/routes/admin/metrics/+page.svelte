<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const counters = $derived(
		Object.entries(data.snapshot.counters).sort(([a], [b]) => a.localeCompare(b))
	);
	const durations = $derived(
		Object.entries(data.snapshot.durations).sort(([a], [b]) => a.localeCompare(b))
	);
</script>

<svelte:head>
	<title>Métriques — Admin</title>
</svelte:head>

<div class="px-6 space-y-8">
	<div>
		<h1 class="text-2xl font-semibold">Métriques applicatives</h1>
		<p class="text-sm text-muted-foreground">
			Compteurs cumulés depuis le dernier redémarrage (mémoire) ou sur 7 jours glissants (Redis).
			Rafraîchir la page relit les valeurs courantes.
		</p>
	</div>

	<section>
		<h2 class="text-lg font-medium mb-2">Compteurs</h2>
		{#if counters.length === 0}
			<p class="text-sm text-muted-foreground">Aucun compteur observé pour l'instant.</p>
		{:else}
			<table class="w-full text-sm border-collapse">
				<thead>
					<tr class="border-b text-left">
						<th class="py-2 pr-4">Nom</th>
						<th class="py-2">Valeur</th>
					</tr>
				</thead>
				<tbody>
					{#each counters as [name, value]}
						<tr class="border-b">
							<td class="py-2 pr-4 font-mono">{name}</td>
							<td class="py-2">{value}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	<section>
		<h2 class="text-lg font-medium mb-2">Durées de job (ms)</h2>
		{#if durations.length === 0}
			<p class="text-sm text-muted-foreground">Aucun job observé pour l'instant.</p>
		{:else}
			<table class="w-full text-sm border-collapse">
				<thead>
					<tr class="border-b text-left">
						<th class="py-2 pr-4">Job</th>
						<th class="py-2 pr-4">Exécutions</th>
						<th class="py-2">Durée moyenne</th>
					</tr>
				</thead>
				<tbody>
					{#each durations as [name, stats]}
						<tr class="border-b">
							<td class="py-2 pr-4 font-mono">{name}</td>
							<td class="py-2 pr-4">{stats.count}</td>
							<td class="py-2">{stats.avgMs} ms</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
</div>
