<script lang="ts">
	/* =========================================================
	   RECHERCHE GLOBALE — palette de commande (shadcn Command +
	   Dialog) plutôt qu'un lien statique vers /products : cherche
	   à la fois dans les produits et les articles de blog, en
	   tapant (debounce 250 ms, requête précédente annulée).
	   Raccourci clavier Cmd/Ctrl+K en plus du clic sur l'icône.
	   ========================================================= */
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import Search from 'lucide-svelte/icons/search';
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import * as Command from '$shadcn/command/index.js';
	import { formatMoney } from '$lib/utils/formatMoney';
	import { page } from '$app/state';
	import { toTTC } from '$lib/utils/price';
	import { optimizedImageUrl } from '$lib/utils/cloudinaryUrl';

	type ProductResult = {
		id: string;
		slug: string;
		name: string;
		price: number;
		image: string | null;
	};
	type PostResult = { id: string; slug: string; title: string };

	// Prix stockés HT : affichage TTC (taux global fourni par le layout racine).
	const ttc = (priceHT: number) => toTTC(priceHT, page.data.vatRate ?? 0);

	let open = $state(false);
	let query = $state('');
	let products = $state<ProductResult[]>([]);
	let posts = $state<PostResult[]>([]);
	let loading = $state(false);
	let searched = $state(false);

	let debounceTimer: ReturnType<typeof setTimeout>;
	let activeAbort: AbortController | null = null;

	$effect(() => {
		const q = query.trim();
		clearTimeout(debounceTimer);
		activeAbort?.abort();

		if (q.length < 2) {
			products = [];
			posts = [];
			loading = false;
			searched = false;
			return;
		}

		loading = true;
		debounceTimer = setTimeout(async () => {
			const controller = new AbortController();
			activeAbort = controller;
			try {
				const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
					signal: controller.signal
				});
				if (!res.ok || controller.signal.aborted) return;
				const body = await res.json();
				if (controller.signal.aborted) return;
				products = body.products ?? [];
				posts = body.posts ?? [];
				searched = true;
			} catch {
				// Requête annulée par une frappe suivante, ou réseau — pas d'erreur
				// intrusive pour une recherche en direct.
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		}, 250);

		return () => clearTimeout(debounceTimer);
	});

	function closeAndReset() {
		open = false;
		query = '';
		products = [];
		posts = [];
		searched = false;
	}

	// Navigation explicite plutôt que de compter sur l'action par défaut du
	// <a> : `Command.LinkItem` déclenche `onSelect` via un `.click()`
	// programmatique (sélection clavier) dont l'action par défaut du navigateur
	// n'est pas fiable une fois l'élément retiré du DOM par la fermeture du
	// dialogue — `goto()` marche dans tous les cas (clic, clavier).
	function selectResult(href: string) {
		closeAndReset();
		goto(href);
	}

	function onKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			open = true;
		}
	}

	onMount(() => {
		window.addEventListener('keydown', onKeydown);
	});
	onDestroy(() => {
		if (!browser) return;
		window.removeEventListener('keydown', onKeydown);
		clearTimeout(debounceTimer);
	});
</script>

<button
	type="button"
	class="shop-icon-ph"
	aria-label="Rechercher (Ctrl+K)"
	onclick={() => (open = true)}
>
	<Search size={13} />
</button>

<Command.Dialog
	bind:open
	shouldFilter={false}
	title="Recherche"
	description="Rechercher un produit ou un article de blog"
>
	<Command.Input bind:value={query} placeholder="Rechercher un produit, un article…" />
	<Command.List>
		{#if loading}
			<div class="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
				<LoaderCircle size={16} class="animate-spin" /> Recherche…
			</div>
		{:else if searched && products.length === 0 && posts.length === 0}
			<Command.Empty>Aucun résultat pour « {query} ».</Command.Empty>
		{:else if !searched}
			<Command.Empty>Tapez au moins 2 caractères pour rechercher.</Command.Empty>
		{/if}

		{#if products.length > 0}
			<Command.Group heading="Produits">
				{#each products as product (product.id)}
					<Command.LinkItem
						href={`/products/${product.slug}`}
						value={`product-${product.slug}`}
						onSelect={() => selectResult(`/products/${product.slug}`)}
					>
						{#if product.image}
							<img
								src={optimizedImageUrl(product.image, 40)}
								alt=""
								class="size-8 shrink-0 rounded object-cover"
							/>
						{/if}
						<span class="flex-1 truncate">{product.name}</span>
						<span class="text-xs text-muted-foreground">{formatMoney(ttc(product.price))}</span>
					</Command.LinkItem>
				{/each}
			</Command.Group>
		{/if}

		{#if posts.length > 0}
			<Command.Group heading="Blog">
				{#each posts as post (post.id)}
					<Command.LinkItem
						href={`/blog/${post.slug}`}
						value={`post-${post.slug}`}
						onSelect={() => selectResult(`/blog/${post.slug}`)}
					>
						<span class="flex-1 truncate">{post.title}</span>
					</Command.LinkItem>
				{/each}
			</Command.Group>
		{/if}
	</Command.List>
</Command.Dialog>
