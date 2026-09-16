<script lang="ts">
	import Chart from '$lib/components/Chart.svelte';
	import ChartMonthly from '$lib/components/ChartMonthly.svelte';
	import ChartBar from '$lib/components/ChartBar.svelte';
	import LastInscriptions from '$lib/components/LastInscriptions.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import * as Card from '$shadcn/card/index.js';

	let { data } = $props();

	const kpis = $derived(data.kpis);

	/** `null` tant qu'aucune relance n'a été envoyée sur la fenêtre : un taux à
	 * 0% serait trompeur (laisse penser que les relances ont toutes échoué). */
	const recoveryRate = $derived.by(() => {
		if (!kpis || kpis.cartRemindersSentCount === 0) return null;
		return (kpis.cartRemindersRecoveredCount / kpis.cartRemindersSentCount) * 100;
	});

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
				const productName = (product as { name?: string; quantity?: number } | null)?.name;
				if (!productName) continue;
				const productQuantity =
					(product as { name?: string; quantity?: number } | null)?.quantity || 0;
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

	{#if kpis}
		<div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Description>Panier moyen ({kpis.windowDays}j)</Card.Description>
					<Card.Title class="text-2xl">{kpis.averageOrderValue.toFixed(2)} €</Card.Title>
				</Card.Header>
				<Card.Content class="text-muted-foreground text-sm">
					{kpis.paidOrdersCount} commande{kpis.paidOrdersCount > 1 ? 's' : ''} payée{kpis.paidOrdersCount >
					1
						? 's'
						: ''}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Description>Paniers abandonnés ({kpis.windowDays}j)</Card.Description>
					<Card.Title class="text-2xl">{kpis.abandonedCartsCount}</Card.Title>
				</Card.Header>
				<Card.Content class="text-muted-foreground text-sm">
					{#if recoveryRate !== null}
						{kpis.cartRemindersRecoveredCount}/{kpis.cartRemindersSentCount} relances converties
						({recoveryRate.toFixed(0)}%)
					{:else}
						Aucune relance envoyée sur la période
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Description>Stock bas</Card.Description>
					<Card.Title class="text-2xl">{kpis.lowStockCount}</Card.Title>
				</Card.Header>
				<Card.Content class="text-muted-foreground text-sm">
					{#if kpis.lowStockSample.length > 0}
						<ul class="space-y-0.5">
							{#each kpis.lowStockSample as product (product.id)}
								<li class="truncate">{product.name} — {product.stock} restant{product.stock > 1 ? 's' : ''}</li>
							{/each}
						</ul>
					{:else}
						Aucun produit sous le seuil
					{/if}
				</Card.Content>
			</Card.Root>

			{#if data.returnsEnabled || data.productQnaEnabled}
				<Card.Root>
					<Card.Header class="pb-2">
						<Card.Description>À traiter</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-1 text-sm">
						{#if data.returnsEnabled}
							<p>{kpis.pendingReturnsCount} retour{kpis.pendingReturnsCount > 1 ? 's' : ''} en attente</p>
						{/if}
						{#if data.productQnaEnabled}
							<p>
								{kpis.unansweredQuestionsCount} question{kpis.unansweredQuestionsCount > 1 ? 's' : ''}
								sans réponse
							</p>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}
		</div>

		<div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Description>Commandes par statut ({kpis.windowDays}j)</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-1 text-sm">
					<p>{kpis.ordersByStatus.PENDING} en attente</p>
					<p>{kpis.ordersByStatus.PAID} payée{kpis.ordersByStatus.PAID > 1 ? 's' : ''}</p>
					<p>{kpis.ordersByStatus.SHIPPED} expédiée{kpis.ordersByStatus.SHIPPED > 1 ? 's' : ''}</p>
					<p>{kpis.ordersByStatus.CANCELLED} annulée{kpis.ordersByStatus.CANCELLED > 1 ? 's' : ''}</p>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Description>Clients</Card.Description>
					<Card.Title class="text-2xl">+{kpis.newCustomersCount}</Card.Title>
				</Card.Header>
				<Card.Content class="text-muted-foreground text-sm">
					nouveaux ({kpis.windowDays}j) — {kpis.recurringCustomersCount}/{kpis.payingCustomersCount}
					client{kpis.payingCustomersCount > 1 ? 's' : ''} payeur{kpis.payingCustomersCount > 1 ? 's' : ''}
					récurrent{kpis.recurringCustomersCount > 1 ? 's' : ''}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Description>Catalogue</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-1 text-sm">
					<p>{kpis.neverSoldProductsCount} produit{kpis.neverSoldProductsCount > 1 ? 's' : ''} jamais vendu{kpis.neverSoldProductsCount > 1 ? 's' : ''}</p>
					{#if kpis.reviewsCount > 0}
						<p>
							Note moyenne {kpis.averageReviewRating.toFixed(1)}/5 ({kpis.reviewsCount} avis, +{kpis.newReviewsCount}
							sur {kpis.windowDays}j)
						</p>
					{:else}
						<p>Aucun avis pour l'instant</p>
					{/if}
				</Card.Content>
			</Card.Root>

			{#if data.giftCardsEnabled || data.loyaltyEnabled}
				<Card.Root>
					<Card.Header class="pb-2">
						<Card.Description>Marketing & fidélité</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-1 text-sm">
						<p>
							{kpis.soonExpiringPromoCodesCount} code{kpis.soonExpiringPromoCodesCount > 1 ? 's' : ''}
							promo expire{kpis.soonExpiringPromoCodesCount > 1 ? 'nt' : ''} sous 7j
						</p>
						{#if data.giftCardsEnabled}
							<p>{kpis.giftCardOutstandingBalance.toFixed(2)} € d'encours cartes cadeaux</p>
						{/if}
						{#if data.loyaltyEnabled}
							<p>
								{kpis.loyaltyAwardsCount} récompense{kpis.loyaltyAwardsCount > 1 ? 's' : ''} fidélité
								accordée{kpis.loyaltyAwardsCount > 1 ? 's' : ''} ({kpis.windowDays}j)
							</p>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}

			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Description>Contact</Card.Description>
					<Card.Title class="text-2xl">{kpis.newContactSubmissionsCount}</Card.Title>
				</Card.Header>
				<Card.Content class="text-muted-foreground text-sm">
					message{kpis.newContactSubmissionsCount > 1 ? 's' : ''} reçu{kpis.newContactSubmissionsCount >
					1
						? 's'
						: ''} ({kpis.windowDays}j)
				</Card.Content>
			</Card.Root>
		</div>
	{/if}

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
