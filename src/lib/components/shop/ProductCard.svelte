<script lang="ts">
	import { splatCard } from '$lib/actions/splatCard';
	import { reveal } from '$lib/actions/reveal';
	import { formatMoney } from '$lib/utils/formatMoney';

	let {
		product,
		index = 0,
		revealOnScroll = true
	}: {
		product: { slug: string; name: string; price: number; images: string[] };
		index?: number;
		revealOnScroll?: boolean;
	} = $props();
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
			<img src={product.images[0]} alt={product.name} loading="lazy" />
		{:else}
			Image produit
		{/if}
	</div>
	<p class="shop-card-title">{product.name}</p>
	<p class="shop-card-price">{formatMoney(product.price)}</p>
</a>
