<script lang="ts">
	import { goto } from '$app/navigation';
	import { page as appPage } from '$app/state';
	import Search from 'lucide-svelte/icons/search';
	import X from 'lucide-svelte/icons/x';
	import SlidersHorizontal from 'lucide-svelte/icons/sliders-horizontal';
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import { reveal } from '$lib/actions/reveal';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	let { data } = $props();

	let products = $derived(data.products);
	let facets = $derived(data.facets);
	let page = $derived(data.page);
	let search = $derived(data.search);
	let totalPages = $derived(Math.max(1, Math.ceil(data.total / data.perPage)));

	const SORT_LABELS: Record<string, string> = {
		pertinence: 'Pertinence',
		'prix-asc': 'Prix croissant',
		'prix-desc': 'Prix décroissant',
		nouveaute: 'Nouveautés'
	};

	let minPriceInput = $state<string>('');
	let maxPriceInput = $state<string>('');
	$effect(() => {
		minPriceInput = data.minPrice !== undefined ? String(data.minPrice) : '';
		maxPriceInput = data.maxPrice !== undefined ? String(data.maxPrice) : '';
	});

	/**
	 * Fusionne des paramètres dans l'URL courante et recharge `load()` — seul
	 * mécanisme de mise à jour des filtres. `null`/`undefined`/`[]` retire le
	 * paramètre. Toute modification de filtre revient à la page 1, sauf si
	 * `page` est explicitement fourni (pagination elle-même).
	 */
	function updateFilters(
		patch: Record<string, string | number | boolean | string[] | null | undefined>
	) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, jeté après toString(), jamais assigné à un state
		const params = new URLSearchParams(appPage.url.search);
		for (const [key, value] of Object.entries(patch)) {
			params.delete(key);
			if (value === null || value === undefined || value === '' || value === false) continue;
			if (Array.isArray(value)) {
				for (const v of value) params.append(key, v);
			} else {
				params.set(key, String(value));
			}
		}
		if (!('page' in patch)) params.delete('page');
		const query = params.toString();
		goto(query ? `/products?${query}` : '/products', { keepFocus: true, noScroll: true });
	}

	function toggleTaxonomyValue(slug: string, value: string) {
		const current = data.taxonomyFilters[slug] ?? [];
		const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
		updateFilters({ [slug]: next });
	}

	function commitPriceRange() {
		const min = minPriceInput !== '' ? Number(minPriceInput) : null;
		const max = maxPriceInput !== '' ? Number(maxPriceInput) : null;
		updateFilters({
			prixMin: min !== null && !Number.isNaN(min) ? min : null,
			prixMax: max !== null && !Number.isNaN(max) ? max : null
		});
	}

	function pageHref(target: number): string {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, jeté après toString(), jamais assigné à un state
		const params = new URLSearchParams(appPage.url.search);
		if (target > 1) params.set('page', String(target));
		else params.delete('page');
		const query = params.toString();
		return query ? `/products?${query}` : '/products';
	}

	let clearSearchHref = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, jeté après toString(), jamais assigné à un state
		const params = new URLSearchParams(appPage.url.search);
		params.delete('q');
		params.delete('page');
		const query = params.toString();
		return query ? `/products?${query}` : '/products';
	});

	let activeFilterCount = $derived(
		Object.values(data.taxonomyFilters).reduce((sum, values) => sum + values.length, 0) +
			(data.minPrice !== undefined ? 1 : 0) +
			(data.maxPrice !== undefined ? 1 : 0) +
			(data.inStockOnly ? 1 : 0)
	);

	function resetFilters() {
		updateFilters({
			...Object.fromEntries(facets.taxonomies.map((t) => [t.slug, []])),
			prixMin: null,
			prixMax: null,
			dispo: null
		});
	}
</script>

<svelte:head>
	<title>Boutique — MadeInDiamonds</title>
</svelte:head>

<nav class="shop-breadcrumb"><a href="/">Accueil</a> / Boutique</nav>

<main class="shop-container">
	<form
		method="GET"
		action="/products"
		class="shop-search-bar"
		onsubmit={(e) => {
			e.preventDefault();
			const q = new FormData(e.currentTarget).get('q');
			updateFilters({ q: typeof q === 'string' ? q : null });
		}}
	>
		<input type="search" name="q" value={search} placeholder="Rechercher un produit" />
		<button type="submit" class="shop-btn">
			<Search size={14} />
		</button>
		{#if search}
			<a href={clearSearchHref} class="shop-icon-ph" aria-label="Effacer la recherche">
				<X size={13} />
			</a>
		{/if}
	</form>

	<div class="shop-listing-layout">
		<aside class="shop-filters" use:reveal>
			<div class="shop-filter-group">
				<h4>Prix</h4>
				<div class="shop-price-range">
					<input
						type="number"
						min="0"
						placeholder="Min"
						bind:value={minPriceInput}
						onchange={commitPriceRange}
						aria-label="Prix minimum"
					/>
					<span>—</span>
					<input
						type="number"
						min="0"
						placeholder="Max"
						bind:value={maxPriceInput}
						onchange={commitPriceRange}
						aria-label="Prix maximum"
					/>
				</div>
			</div>

			{#each facets.taxonomies as taxonomy (taxonomy.slug)}
				<div class="shop-filter-group">
					<h4>{taxonomy.name}</h4>
					<ul>
						{#each taxonomy.values as value (value.value)}
							<li>
								<label>
									<input
										type="checkbox"
										checked={(data.taxonomyFilters[taxonomy.slug] ?? []).includes(value.value)}
										onchange={() => toggleTaxonomyValue(taxonomy.slug, value.value)}
									/>
									{#if taxonomy.type === 'COLOR' && value.code}
										<span
											class="shop-swatch"
											style={`width:16px;height:16px;background:${value.code};`}
										></span>
									{/if}
									{value.label}
									<span style="color:var(--shop-text-muted); font-size:11px;">({value.count})</span>
								</label>
							</li>
						{/each}
					</ul>
				</div>
			{/each}

			<div class="shop-filter-group">
				<h4>Disponibilité</h4>
				<label>
					<input
						type="checkbox"
						checked={data.inStockOnly}
						onchange={(e) => updateFilters({ dispo: e.currentTarget.checked ? '1' : null })}
					/>
					En stock uniquement
				</label>
			</div>

			{#if activeFilterCount > 0}
				<button type="button" class="shop-reset-filters" onclick={resetFilters}>
					Réinitialiser les filtres ({activeFilterCount})
				</button>
			{/if}
		</aside>

		<div class="shop-listing-main">
			<div class="shop-listing-head">
				<div>
					<h1 class="shop-section-title" style="margin-bottom:4px;">Boutique</h1>
					<p class="shop-result-count">
						{data.total} produit{data.total > 1 ? 's' : ''}
					</p>
				</div>
				<select
					class="shop-sort-select"
					value={data.sort}
					onchange={(e) =>
						updateFilters({ tri: e.currentTarget.value === 'pertinence' ? null : e.currentTarget.value })}
				>
					{#each Object.entries(SORT_LABELS) as [value, label] (value)}
						<option {value}>{label}</option>
					{/each}
				</select>
			</div>

			{#if products.length === 0}
				<p class="shop-empty-results">
					{#if search}
						Aucun produit ne correspond à « {search} ».
					{:else}
						Aucun produit ne correspond à ces filtres.
					{/if}
				</p>
			{:else}
				<div class="shop-grid shop-grid-4">
					{#each products as product, i (product.id)}
						<div in:fly={{ y: 18, duration: 400, delay: i * 45, easing: quintOut }}>
							<ProductCard {product} revealOnScroll={false} flashSaleEnabled={data.flashSaleEnabled} />
						</div>
					{/each}
				</div>

				{#if totalPages > 1}
					<nav class="shop-pagination shop-pagination-text" aria-label="Pagination">
						{#if page > 1}
							<a href={pageHref(page - 1)} class="shop-btn shop-btn-outline">Précédent</a>
						{/if}
						<span class="shop-result-count">Page {page} / {totalPages}</span>
						{#if page < totalPages}
							<a href={pageHref(page + 1)} class="shop-btn shop-btn-outline">Suivant</a>
						{/if}
					</nav>
				{/if}
			{/if}
		</div>
	</div>
</main>

<style>
	.shop-search-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: 420px;
		margin: 24px auto 0;
	}
	.shop-search-bar input {
		flex: 1;
		padding: 10px 12px;
		border: 1px solid var(--shop-border-strong);
		background: var(--shop-bg);
		color: var(--shop-text);
		font: inherit;
		font-size: 13px;
	}
	.shop-search-bar input:focus {
		outline: none;
		border-color: var(--shop-text);
	}
	.shop-pagination-text {
		align-items: center;
	}
	.shop-reset-filters {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		font-size: 13px;
		color: var(--shop-text-muted);
		text-decoration: underline;
		cursor: pointer;
		text-align: left;
		width: fit-content;
	}
	.shop-reset-filters:hover {
		color: var(--shop-text);
	}
	.shop-pagination-text .shop-btn {
		width: auto;
		height: auto;
		padding: 8px 16px;
	}

	/* Sidebar filtres : hors écrans larges, repli en volet natif (léger, sans
	   dépendance) pour ne pas prendre toute la largeur sur mobile. */
	@media (max-width: 860px) {
		:global(.shop-listing-layout) {
			display: block;
		}
		:global(.shop-filters) {
			margin-bottom: 24px;
		}
	}
</style>
