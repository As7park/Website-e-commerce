<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import '@fontsource-variable/source-sans-3';
	import '#lib/styles/shop.css';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import ShopHeader from '#lib/components/shop/ShopHeader.svelte';
	import ShopFooter from '#lib/components/shop/ShopFooter.svelte';
	import WheelCursor from '#lib/components/shop/WheelCursor.svelte';
	import CookieNotice from '#lib/components/CookieNotice.svelte';
	import { startShopScroll, syncShopScroll } from '#lib/shop/fx';

	/**
	 * Habillage commun à tout le site public (tout sauf `/admin`) : header,
	 * footer, curseur et thème sombre `shop.css`. Posé par le layout racine
	 * plutôt que par un groupe de routes, pour couvrir toutes les pages
	 * (auth, compte client, pages légales, suivi) et les erreurs 404.
	 */
	let { children, data }: { children: Snippet; data: Record<string, unknown> } = $props();

	let progressEl: HTMLDivElement;

	onMount(() => startShopScroll(progressEl));
	afterNavigate(() => syncShopScroll());
</script>

<div id="shop-scope" class="shop-scope">
	<div class="shop-scroll-progress" bind:this={progressEl} aria-hidden="true"></div>
	<a href="#main-content" class="shop-skip-link">Aller au contenu</a>
	<!-- L'accueil rend son header lui-même, épinglé avec le hero (HomeOpening). -->
	{#if !page.data.ownHeader}
		<ShopHeader {data} />
	{/if}
	{#key page.url.pathname}
		<div id="main-content" class="shop-page-body" in:fade={{ duration: 280, delay: 60 }}>
			{@render children()}
		</div>
	{/key}
	<ShopFooter />
	<WheelCursor />
	<CookieNotice />
</div>
