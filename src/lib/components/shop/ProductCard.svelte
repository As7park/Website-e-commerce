<script lang="ts">
	import { splatCard } from '$lib/actions/splatCard';
	import { reveal } from '$lib/actions/reveal';
	import { formatMoney } from '$lib/utils/formatMoney';
	import { page } from '$app/state';
	import { toTTC } from '$lib/utils/price';
	import { optimizedImageUrl } from '$lib/utils/cloudinaryUrl';
	import FlashSaleCountdown from '$lib/components/products/FlashSaleCountdown.svelte';

	let {
		product,
		index = 0,
		revealOnScroll = true,
		flashSaleEnabled = false
	}: {
		product: {
			slug: string;
			name: string;
			price: number;
			images: string[];
			stock?: number;
			compareAtPrice?: number | null;
			flashSaleEndsAt?: string | Date | null;
			material?: { name: string } | null;
		};
		index?: number;
		revealOnScroll?: boolean;
		flashSaleEnabled?: boolean;
	} = $props();

	let hasDiscount = $derived(
		Boolean(product.compareAtPrice && product.compareAtPrice > product.price)
	);
	let discountPercent = $derived(
		hasDiscount ? Math.round((1 - product.price / product.compareAtPrice!) * 100) : 0
	);
	let outOfStock = $derived(product.stock !== undefined && product.stock <= 0);

	// Prix stockés HT : affichage TTC (taux global fourni par le layout racine).
	const ttc = (priceHT: number) => toTTC(priceHT, page.data.vatRate ?? 0);
</script>

<a
	class="shop-card"
	href={`/products/${product.slug}`}
	data-wheel-nav
	use:splatCard
	use:reveal={{ delay: index * 70, enabled: revealOnScroll }}
>
	<div class="shop-ph shop-ph-portrait">
		{#if product.images?.[0]}
			<img src={optimizedImageUrl(product.images[0], 400)} alt={product.name} loading="lazy" />
		{:else}
			Image produit
		{/if}
		{#if hasDiscount}
			<span class="shop-badge shop-badge-discount">-{discountPercent}%</span>
		{/if}
		{#if outOfStock}
			<span class="shop-badge shop-badge-outofstock">Épuisé</span>
		{/if}
		{#if product.flashSaleEndsAt && flashSaleEnabled}
			<span class="shop-badge shop-badge-flash">
				<FlashSaleCountdown endsAt={product.flashSaleEndsAt} variant="compact" />
			</span>
		{/if}
	</div>
	{#if product.material}
		<p class="shop-card-meta">{product.material.name}</p>
	{/if}
	<p class="shop-card-title">{product.name}</p>
	<p class="shop-card-price">
		{#if hasDiscount}
			<span class="shop-old">{formatMoney(ttc(product.compareAtPrice!))}</span>
		{/if}
		{formatMoney(ttc(product.price))}
	</p>
</a>

<style>
	.shop-badge {
		position: absolute;
		z-index: 3;
		font-size: 11px;
		font-weight: 700;
		padding: 3px 7px;
		border-radius: 3px;
		letter-spacing: 0.02em;
	}
	.shop-badge-discount {
		top: 8px;
		left: 8px;
		background: var(--shop-orange);
		color: var(--shop-ink);
	}
	.shop-badge-outofstock {
		top: 8px;
		right: 8px;
		background: var(--shop-bg);
		color: var(--shop-text-muted);
		border: 1px solid var(--shop-border-strong);
	}
	.shop-badge-flash {
		bottom: 8px;
		left: 8px;
	}
</style>
