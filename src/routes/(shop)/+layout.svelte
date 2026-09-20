<script lang="ts">
	import './shop.css';
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';
	import ShopHeader from '$lib/components/shop/ShopHeader.svelte';
	import ShopFooter from '$lib/components/shop/ShopFooter.svelte';
	import WheelCursor from '$lib/components/shop/WheelCursor.svelte';

	let { children, data } = $props();
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
	<ShopHeader {data} />
	{#key $page.url.pathname}
		<div in:fade={{ duration: 280, delay: 60 }}>
			{@render children()}
		</div>
	{/key}
	<ShopFooter />
	<WheelCursor />
</div>
