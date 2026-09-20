<script lang="ts">
	import { goto } from '$app/navigation';
	import { page as appPage } from '$app/state';
	import Search from 'lucide-svelte/icons/search';
	import X from 'lucide-svelte/icons/x';
	import SEO from '$lib/components/SEO.svelte';
	import { reveal } from '$lib/actions/reveal';
	import { splatCard } from '$lib/actions/splatCard';

	let { data } = $props();

	let activeCategoryId = $derived(data.activeCategoryId);
	let activeTagId = $derived(data.activeTagId);
	let posts = $derived(data.posts);
	let categories = $derived(data.categories);
	let tags = $derived(data.tags);
	let page = $derived(data.page);
	let totalPages = $derived(Math.max(1, Math.ceil(data.total / data.perPage)));
	let searchInput = $state('');
	$effect(() => {
		searchInput = data.search;
	});

	let hasActiveFilters = $derived(!!activeCategoryId || !!activeTagId || !!data.search);

	/** Fusionne des paramètres dans l'URL courante. Toute modification de filtre revient à la page 1, sauf pagination elle-même. */
	function filterHref(patch: Record<string, string | number | null | undefined>): string {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, jeté après toString(), jamais assigné à un state
		const params = new URLSearchParams(appPage.url.search);
		for (const [key, value] of Object.entries(patch)) {
			params.delete(key);
			if (value === null || value === undefined || value === '') continue;
			params.set(key, String(value));
		}
		if (!('page' in patch)) params.delete('page');
		const query = params.toString();
		return query ? `/blog?${query}` : '/blog';
	}

	function pageHref(target: number): string {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, jeté après toString(), jamais assigné à un state
		const params = new URLSearchParams(appPage.url.search);
		if (target > 1) params.set('page', String(target));
		else params.delete('page');
		const query = params.toString();
		return query ? `/blog?${query}` : '/blog';
	}

	function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		goto(filterHref({ q: searchInput.trim() || null }), { keepFocus: true, noScroll: true });
	}
</script>

<SEO pageKey="blog" />

<nav class="shop-breadcrumb"><a href="/">Accueil</a> / Blog</nav>

<main class="shop-container">
	<div class="shop-listing-layout">
		<aside class="shop-filters" use:reveal>
			<div class="shop-filter-group">
				<h4>Rechercher</h4>
				<form onsubmit={submitSearch} class="shop-search-bar" style="margin:0; max-width:none;">
					<input
						type="search"
						bind:value={searchInput}
						placeholder="Rechercher un article…"
						aria-label="Rechercher un article"
					/>
					<button type="submit" class="shop-btn" style="width:auto; height:auto; padding:8px 12px;">
						<Search size={13} />
					</button>
				</form>
			</div>

			<div class="shop-filter-group">
				<h4>Catégorie</h4>
				<ul>
					<li>
						<a href={filterHref({ categorie: null })} class:shop-active-filter={!activeCategoryId}>
							Toutes
						</a>
					</li>
					{#each categories as category (category.id)}
						<li>
							<a
								href={filterHref({ categorie: category.id })}
								class:shop-active-filter={activeCategoryId === category.id}
							>
								{category.name}
							</a>
						</li>
					{/each}
				</ul>
			</div>

			{#if tags.length > 0}
				<div class="shop-filter-group">
					<h4>Tags</h4>
					<div style="display:flex; flex-wrap:wrap; gap:8px;">
						{#each tags as tag (tag.id)}
							<a
								href={filterHref({ tag: activeTagId === tag.id ? null : tag.id })}
								class="shop-tag"
								class:shop-active-filter={activeTagId === tag.id}
							>
								#{tag.name}
							</a>
						{/each}
					</div>
				</div>
			{/if}

			{#if hasActiveFilters}
				<a href="/blog" class="shop-reset-filters"><X size={13} /> Effacer les filtres</a>
			{/if}
		</aside>

		<div class="shop-listing-main">
			<div class="shop-listing-head">
				<div>
					<h1 class="shop-section-title" style="margin-bottom:4px;">Blog</h1>
					<p class="shop-result-count">
						{data.total} article{data.total > 1 ? 's' : ''}
					</p>
				</div>
			</div>

			{#if posts.length === 0}
				<p class="shop-empty-results">
					{#if data.search}
						Aucun article ne correspond à « {data.search} ».
					{:else}
						Aucun article dans cette sélection.
					{/if}
				</p>
			{:else}
				<div class="shop-grid shop-grid-3">
					{#each posts as post, i (post.id)}
						<a
							class="shop-card"
							href="/blog/{post.slug}"
							data-wheel-nav
							use:splatCard
							use:reveal={{ delay: i * 60 }}
						>
							<div class="shop-ph shop-ph-landscape">Article</div>
							{#if post.category}
								<p class="shop-card-meta">{post.category.name}</p>
							{/if}
							<p class="shop-card-title">{post.title}</p>
							<p class="shop-card-meta">
								{post.author.name} · {new Date(post.createdAt).toLocaleDateString('fr-FR')}
							</p>
						</a>
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
