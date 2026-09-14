<script lang="ts">
	import { addToCart } from '$lib/store/Data/cartStore';
	import Button from '$shadcn/button/button.svelte';
	import { Textarea } from '$shadcn/textarea';
	import * as Form from '$shadcn/form';
	import { optimizedImageUrl } from '$lib/utils/cloudinaryUrl';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { reviewSchema } from '$lib/schema/products/reviewSchema';
	import StarRating from '$lib/components/reviews/StarRating.svelte';
	import Heart from 'lucide-svelte/icons/heart';
	import * as Card from '$shadcn/card';
	import { Badge } from '$shadcn/badge';

	let { data } = $props();
	let product = $derived(data.product);
	let categoryNames = $derived(
		product.categories.map((link) => link.category.name).filter(Boolean)
	);

	let inWishlist = $state(data.inWishlist);
	let wishlistBusy = $state(false);
	let hasDiscount = $derived(
		Boolean(product.compareAtPrice) && (product.compareAtPrice as number) > product.price
	);
	let discountPercent = $derived(
		hasDiscount ? Math.round((1 - product.price / (product.compareAtPrice as number)) * 100) : 0
	);

	async function toggleWishlist() {
		if (!data.user) {
			window.location.href = '/auth/login';
			return;
		}
		wishlistBusy = true;
		try {
			const res = await fetch('/api/wishlist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ productId: product.id })
			});
			if (res.ok) {
				const result = await res.json();
				inWishlist = result.inWishlist;
			}
		} finally {
			wishlistBusy = false;
		}
	}

	function handleAddToCart() {
		addToCart({
			id: crypto.randomUUID(),
			product: {
				id: product.id,
				name: product.name,
				price: product.price,
				images: product.images[0] ?? '',
				stock: product.stock
			},
			quantity: 1,
			price: product.price
		});
	}

	const reviewFormCtx = superForm(data.form, {
		validators: zodClient(reviewSchema),
		id: 'reviewForm',
		resetForm: true
	});
	const { form: reviewData, enhance: reviewEnhance, message: reviewMessage } = reviewFormCtx;

	$effect(() => {
		if (!$reviewMessage) return;
		if ($reviewMessage === 'Avis publié, merci !') {
			toast.success($reviewMessage);
		} else {
			toast.error($reviewMessage);
		}
	});
</script>

<article class="mx-auto max-w-[960px] px-6 pt-24 pb-12">
	<p class="mb-6">
		<a href="/products" class="text-foreground">← Offres</a>
	</p>
	<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
		<div>
			{#if product.images[0]}
				<img
					src={optimizedImageUrl(product.images[0], 800)}
					alt={product.name}
					class="h-auto w-full object-cover"
				/>
			{/if}
		</div>
		<div>
			<h1 class="mb-2 font-normal">{product.name}</h1>
			{#if categoryNames.length}
				<p class="mb-3 text-muted-foreground">{categoryNames.join(', ')}</p>
			{/if}

			<div class="mb-3 flex items-center gap-2">
				<StarRating value={data.reviewSummary.average} readonly size="size-4" />
				{#if data.reviewSummary.count > 0}
					<span class="text-sm text-muted-foreground">
						{data.reviewSummary.average.toFixed(1)} · {data.reviewSummary.count} avis
					</span>
				{:else}
					<span class="text-sm text-muted-foreground">Aucun avis pour le moment</span>
				{/if}
			</div>

			<div class="mb-4 flex items-center gap-3">
				<p class="text-2xl">{product.price.toFixed(2)} €</p>
				{#if hasDiscount}
					<p class="text-lg text-muted-foreground line-through">
						{(product.compareAtPrice as number).toFixed(2)} €
					</p>
					<Badge variant="destructive">-{discountPercent}%</Badge>
				{/if}
			</div>
			<p class="mb-3 text-muted-foreground">Stock : {product.stock}</p>
			<p class="mb-6 leading-normal">{product.description}</p>
			<div class="flex items-center gap-3">
				<!-- COMMERCE-PLUGIN : entrée du tunnel depuis le catalogue. -->
				<Button type="button" onclick={handleAddToCart}>Ajouter au panier</Button>
				{#if data.wishlistEnabled}
					<Button
						type="button"
						variant="outline"
						size="icon"
						aria-label={inWishlist ? 'Retirer de la liste d’envies' : 'Ajouter à la liste d’envies'}
						disabled={wishlistBusy}
						onclick={toggleWishlist}
					>
						<Heart class="size-4 {inWishlist ? 'fill-current text-red-500' : ''}" />
					</Button>
				{/if}
			</div>
		</div>
	</div>

	{#if data.relatedProducts.length > 0}
		<section class="mt-16 border-t pt-10">
			<h2 class="mb-6 text-xl font-medium">Vous aimerez aussi</h2>
			<div class="grid grid-cols-2 gap-6 md:grid-cols-4">
				{#each data.relatedProducts as related (related.id)}
					<a href="/products/{related.slug}" class="block">
						<Card.Root class="gap-0 overflow-hidden py-0 transition-colors hover:border-foreground">
							<div class="h-32 w-full shrink-0 overflow-hidden">
								{#if related.images[0]}
									<img
										src={optimizedImageUrl(related.images[0], 300)}
										alt={related.name}
										loading="lazy"
										class="h-full w-full object-cover"
									/>
								{:else}
									<div class="h-full w-full bg-muted" aria-hidden="true"></div>
								{/if}
							</div>
							<Card.Content class="p-3">
								<p class="line-clamp-1 text-sm font-medium">{related.name}</p>
								<p class="text-sm text-muted-foreground">{related.price.toFixed(2)} €</p>
							</Card.Content>
						</Card.Root>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<section class="mt-16 border-t pt-10">
		<h2 class="mb-6 text-xl font-medium">Avis</h2>

		{#if data.user}
			{#if data.hasReviewed}
				<p class="text-muted-foreground mb-8 text-sm">Vous avez déjà noté ce produit — merci !</p>
			{:else}
				<form
					method="POST"
					action="?/review"
					use:reviewEnhance
					class="mb-10 max-w-md space-y-4 rounded-lg border p-4"
				>
					<Form.Field name="rating" form={reviewFormCtx}>
						<Form.Control>
							<Form.Label>Votre note</Form.Label>
							<input type="hidden" name="rating" value={$reviewData.rating} />
							<StarRating bind:value={$reviewData.rating} />
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>

					<Form.Field name="comment" form={reviewFormCtx}>
						<Form.Control>
							<Form.Label>Commentaire (facultatif)</Form.Label>
							<Textarea name="comment" bind:value={$reviewData.comment} rows={3} />
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>

					<Button type="submit">Publier l'avis</Button>
				</form>
			{/if}
		{:else}
			<p class="text-muted-foreground mb-8 text-sm">
				<a href="/auth/login" class="underline">Connectez-vous</a> pour laisser un avis.
			</p>
		{/if}

		{#if data.reviews.length === 0}
			<p class="text-muted-foreground text-sm">Soyez le premier à donner votre avis.</p>
		{:else}
			<ul class="space-y-6">
				{#each data.reviews as review (review.id)}
					<li class="border-b pb-6 last:border-0">
						<div class="mb-1 flex items-center gap-3">
							<StarRating value={review.rating} readonly size="size-3.5" />
							<span class="text-sm font-medium">{review.authorName}</span>
						</div>
						{#if review.comment}
							<p class="text-sm leading-relaxed">{review.comment}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</article>
