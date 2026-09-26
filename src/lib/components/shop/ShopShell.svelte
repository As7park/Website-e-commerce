<script lang="ts">
	import type { Snippet } from 'svelte';
	import '$lib/styles/shop.css';
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';
	import ShopHeader from '$lib/components/shop/ShopHeader.svelte';
	import ShopFooter from '$lib/components/shop/ShopFooter.svelte';
	import WheelCursor from '$lib/components/shop/WheelCursor.svelte';
	import CookieNotice from '$lib/components/CookieNotice.svelte';

	/**
	 * Habillage commun à tout le site public (tout sauf `/admin`) : header,
	 * footer, curseur et thème sombre `shop.css`. Posé par le layout racine
	 * plutôt que par un groupe de routes, pour couvrir aussi les pages hors
	 * `(shop)` (auth, compte client, pages légales, suivi) et les erreurs 404.
	 */
	let { children, data }: { children: Snippet; data: Record<string, unknown> } = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Staatliches&family=Space+Grotesk:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div id="shop-scope" class="shop-scope">
	<a href="#main-content" class="shop-skip-link">Aller au contenu</a>
	<ShopHeader {data} />
	{#key $page.url.pathname}
		<div id="main-content" class="shop-page-body" in:fade={{ duration: 280, delay: 60 }}>
			{@render children()}
		</div>
	{/key}
	<ShopFooter />
	<WheelCursor />
	<CookieNotice />
</div>
