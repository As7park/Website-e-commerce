<script lang="ts">
	import Chart from '$lib/components/Chart.svelte';
	import ChartMonthly from '$lib/components/ChartMonthly.svelte';
	import ChartBar from '$lib/components/ChartBar.svelte';
	import LastInscriptions from '$lib/components/LastInscriptions.svelte';
	import SEO from '$lib/components/SEO.svelte';

	let { data } = $props();

	const transactions = $derived(Array.isArray(data.transactions) ? data.transactions : []);

	/** Le plus récent d'abord (utilisé par `monthlyData`) : un `reduce` en O(n),
	 * plutôt qu'un second tri complet du tableau — `transactionPoints` a déjà
	 * besoin de sa propre passe triée pour l'agrégation par jour, inutile de
	 * trier deux fois la même donnée pour deux besoins différents. */
	const latestTxDate = $derived.by(() => {
		let latest: Date | null = null;
		for (const tx of transactions) {
			if (!tx.createdAt) continue;
			const d = new Date(tx.createdAt);
			if (!latest || d > latest) latest = d;
		}
		return latest;
	});

	/** Un point par jour (somme des montants), pas par transaction : sur une
	 * fenêtre de 12 mois avec plusieurs milliers de transactions, un point par
	 * transaction produirait un axe avec autant de catégories distinctes —
	 * illisible et inutilement coûteux à tracer pour une simple tendance. */
	const transactionPoints = $derived.by(() => {
		const dailyTotals = new Map<string, number>();
		for (const tx of transactions) {
			if (!tx.createdAt) continue;
			const day = new Date(tx.createdAt).toISOString().slice(0, 10);
			dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + (tx.amount ?? 0));
		}

		return [...dailyTotals.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([day, value]) => ({
				label: new Date(day).toLocaleDateString('fr-FR'),
				value
			}));
	});

	const monthlyData = $derived.by(() => {
		if (!latestTxDate) return [];

		const year = latestTxDate.getFullYear();
		const month = latestTxDate.getMonth();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const dailySums = new Array(daysInMonth).fill(0);

		for (const tx of transactions) {
			const d = new Date(tx.createdAt);
			if (d.getFullYear() !== year || d.getMonth() !== month) continue;
			dailySums[d.getDate() - 1] += tx.amount ?? 0;
		}

		for (let i = 1; i < daysInMonth; i++) {
			dailySums[i] += dailySums[i - 1];
		}

		return dailySums.map((sum, idx) => ({
			x: idx + 1,
			y: sum
		}));
	});

	/** Top 10 par quantité, pas tous les produits distincts jamais vendus :
	 * un bar chart avec des centaines de catégories devient illisible et lent
	 * à rendre bien avant d'apporter la moindre lecture utile. */
	const TOP_PRODUCTS_LIMIT = 10;
	const productSalesData = $derived.by(() => {
		const productSales: Record<string, number> = {};

		for (const tx of transactions) {
			if (!Array.isArray(tx.products)) continue;
			for (const product of tx.products) {
				const productName = product?.name as string;
				if (!productName) continue;
				const productQuantity = product?.quantity || 0;
				productSales[productName] = (productSales[productName] ?? 0) + productQuantity;
			}
		}

		return Object.entries(productSales)
			.sort(([, a], [, b]) => b - a)
			.slice(0, TOP_PRODUCTS_LIMIT)
			.map(([key, value]) => ({
				x: key,
				y: value
			}));
	});
</script>

<SEO pageKey="admin" />

<div class="csc m-5">
	<h1 class="mb-4 text-2xl font-bold">Accueil</h1>

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<div class="aspect-video rounded border p-5">
			<Chart
				data={transactionPoints}
				title="Transactions"
				valueLabel="Montant"
			/>
		</div>

		<div class="aspect-video rounded border p-5">
			<ChartMonthly data={monthlyData} title="Cumul mensuel des commandes" />
		</div>

		<LastInscriptions users={data.latestUsersFetch} />

		<div class="aspect-video rounded border p-5">
			<ChartBar data={productSalesData} title="Produits vendus" />
		</div>
	</div>
</div>
