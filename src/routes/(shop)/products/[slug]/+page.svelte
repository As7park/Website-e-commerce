<script lang="ts">
	import { untrack } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { addToCart } from '$lib/store/Data/cartStore';
	import { optimizedImageUrl } from '$lib/utils/cloudinaryUrl';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { reviewSchema } from '$lib/schema/products/reviewSchema';
	import { askQuestionSchema } from '$lib/schema/products/questionSchema';
	import StarRating from '$lib/components/reviews/StarRating.svelte';
	import Heart from 'lucide-svelte/icons/heart';
	import SEO from '$lib/components/SEO.svelte';
	import StructuredData from '$lib/components/StructuredData.svelte';
	import { seoConfig } from '$lib/seo.config';
	import { toTTC } from '$lib/utils/price';
	import { readRecentlyViewed, recordProductView } from '$lib/store/recentlyViewed';
	import FlashSaleCountdown from '$lib/components/products/FlashSaleCountdown.svelte';
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import { reveal } from '$lib/actions/reveal';

	let { data } = $props();
	let product = $derived(data.product);

	let activeImageIndex = $state(0);
	$effect(() => {
		product.id;
		activeImageIndex = 0;
	});
	let mainImage = $derived(product.images[activeImageIndex] ?? product.images[0]);

	let recentlyViewed = $state<ReturnType<typeof readRecentlyViewed>>([]);
	$effect(() => {
		// Capture la visite courante puis lit l'historique — dans cet ordre,
		// le produit affiché ici n'est jamais celui qu'on est déjà en train
		// de consulter (il vient d'être placé en tête, filtré juste après).
		recordProductView({
			id: product.id,
			slug: product.slug,
			name: product.name,
			price: product.price,
			image: product.images[0] ?? null
		});
		recentlyViewed = readRecentlyViewed().filter((item) => item.id !== product.id);
	});

	let categoryNames = $derived(
		product.categories.map((link) => link.category.name).filter(Boolean)
	);

	let breadcrumbData = $derived({
		itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Accueil', item: seoConfig.site.url },
			{
				'@type': 'ListItem',
				position: 2,
				name: 'Boutique',
				item: `${seoConfig.site.url}/products`
			},
			{
				'@type': 'ListItem',
				position: 3,
				name: product.name,
				item: `${seoConfig.site.url}/products/${product.slug}`
			}
		]
	});

	let inWishlist = $state(untrack(() => data.inWishlist));
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

	// STOCK_ALERT-PLUGIN : "Me prévenir" — bascule l'inscription à la file
	// d'attente de réassort, même patron que `toggleWishlist` ci-dessus.
	let stockAlertSubscribed = $state(untrack(() => data.stockAlertSubscribed));
	let stockAlertBusy = $state(false);

	async function toggleStockAlert() {
		if (!data.user) {
			window.location.href = '/auth/login';
			return;
		}
		stockAlertBusy = true;
		try {
			const res = await fetch('/api/stock-alerts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ productId: product.id })
			});
			if (res.ok) {
				const result = await res.json();
				stockAlertSubscribed = result.subscribed;
			}
		} finally {
			stockAlertBusy = false;
		}
	}

	// Variantes (`ProductVariant`) : un produit sans variante se comporte
	// exactement comme avant leur introduction (`selectedVariant` reste
	// `null`, jamais de sélection imposée).
	let selectedVariantId = $state<string | null>(untrack(() => product.variants[0]?.id ?? null));
	let selectedVariant = $derived(product.variants.find((v) => v.id === selectedVariantId) ?? null);
	let displayedPrice = $derived(selectedVariant?.price ?? product.price);
	let displayedStock = $derived(selectedVariant?.stock ?? product.stock);
	// Affichage uniquement — le panier reçoit toujours le prix HT (voir
	// handleAddToCart), la TVA y est calculée séparément.
	let displayedPriceTTC = $derived(toTTC(displayedPrice, data.vatRate));
	let quantity = $state(1);
	let justAdded = $state(false);

	function decreaseQty() {
		quantity = Math.max(1, quantity - 1);
	}
	function increaseQty() {
		quantity = Math.min(displayedStock, quantity + 1);
	}

	function handleAddToCart() {
		if (product.variants.length > 0 && !selectedVariant) {
			toast.error('Choisissez une variante.');
			return;
		}
		if (displayedStock <= 0) {
			toast.error('Rupture de stock.');
			return;
		}
		const requestedQuantity = Math.trunc(quantity);
		if (!Number.isFinite(requestedQuantity) || requestedQuantity < 1) {
			toast.error('Quantité invalide.');
			return;
		}
		if (requestedQuantity > displayedStock) {
			toast.error(`Quantité indisponible (stock : ${displayedStock}).`);
			return;
		}

		addToCart({
			id: crypto.randomUUID(),
			product: {
				id: product.id,
				name: product.name,
				price: product.price,
				images: product.images[0] ?? '',
				stock: product.stock,
				weight: product.weight,
				length: product.length,
				width: product.width,
				height: product.height
			},
			variant: selectedVariant
				? {
						id: selectedVariant.id,
						label: selectedVariant.label,
						price: displayedPrice,
						stock: selectedVariant.stock
					}
				: undefined,
			quantity: requestedQuantity,
			price: displayedPrice
		});
		toast.success('Produit ajouté au panier.');
		justAdded = true;
		setTimeout(() => (justAdded = false), 1400);
	}

	const reviewFormCtx = superForm(
		untrack(() => data.form),
		{
			validators: zodClient(reviewSchema),
			id: 'reviewForm',
			resetForm: true
		}
	);
	const { form: reviewData, enhance: reviewEnhance, message: reviewMessage } = reviewFormCtx;

	$effect(() => {
		if (!$reviewMessage) return;
		if ($reviewMessage === 'Avis publié, merci !') {
			toast.success($reviewMessage);
		} else {
			toast.error($reviewMessage);
		}
	});

	const askQuestionFormCtx = superForm(
		untrack(() => data.askForm),
		{
			validators: zodClient(askQuestionSchema),
			id: 'askQuestionForm',
			resetForm: true
		}
	);
	const {
		form: askQuestionData,
		enhance: askQuestionEnhance,
		message: askQuestionMessage
	} = askQuestionFormCtx;

	$effect(() => {
		if (!$askQuestionMessage) return;
		if ($askQuestionMessage.startsWith('Question envoyée')) {
			toast.success($askQuestionMessage);
		} else {
			toast.error($askQuestionMessage);
		}
	});

	let accordionItems = $derived([
		{ title: 'Description', content: product.description },
		{
			title: 'Livraison & retours',
			content: 'Expédié sous 5 à 7 jours ouvrés. Retours acceptés sous 14 jours.'
		}
	]);
	let openPanels = $state([true, false]);
	function togglePanel(i: number) {
		openPanels[i] = !openPanels[i];
	}
</script>

<SEO
	type="product"
	title={product.name}
	description={product.description}
	image={product.images[0] ? optimizedImageUrl(product.images[0], 800) : undefined}
	price={displayedPriceTTC}
	availability={displayedStock > 0 ? 'InStock' : 'OutOfStock'}
	sku={product.sku ?? undefined}
	ratingValue={data.reviewSummary.average}
	reviewCount={data.reviewSummary.count}
/>
<StructuredData type="BreadcrumbList" data={breadcrumbData} />

<nav class="shop-breadcrumb">
	<a href="/">Accueil</a> / <a href="/products">Boutique</a> / {product.name}
</nav>

<main class="shop-container">
	<div class="shop-product-layout">
		<div class="shop-product-gallery" use:reveal>
			<div class="shop-ph shop-ph-portrait">
				{#key mainImage}
					<div style="width:100%; height:100%;" in:fade={{ duration: 280 }}>
						{#if mainImage}
							<img src={optimizedImageUrl(mainImage, 800)} alt={product.name} />
						{:else}
							Image produit
						{/if}
					</div>
				{/key}
				{#if hasDiscount && !selectedVariant}
					<span class="shop-badge shop-badge-discount">-{discountPercent}%</span>
				{/if}
			</div>
			{#if product.images.length > 1}
				<div class="shop-gallery-thumbs">
					{#each product.images as image, i (image)}
						<button
							type="button"
							class:shop-active={i === activeImageIndex}
							onclick={() => (activeImageIndex = i)}
							aria-label={`Vue ${i + 1}`}
						>
							<div class="shop-ph shop-ph-square">
								<img src={optimizedImageUrl(image, 200)} alt="" />
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="shop-product-info" use:reveal={{ delay: 90 }}>
			<div>
				{#if categoryNames.length}
					<p class="shop-eyebrow">{categoryNames.join(', ')}</p>
				{/if}
				{#if product.material}
					<p class="shop-eyebrow">{product.material.name}</p>
				{/if}
				<h1 class="shop-product-title">{product.name}</h1>

				<div style="display:flex; align-items:center; gap:8px; margin:8px 0;">
					<StarRating value={data.reviewSummary.average} readonly size="size-4" />
					{#if data.reviewSummary.count > 0}
						<span style="font-size:13px; color:var(--shop-text-muted);">
							{data.reviewSummary.average.toFixed(1)} · {data.reviewSummary.count} avis
						</span>
					{:else}
						<span style="font-size:13px; color:var(--shop-text-muted);"
							>Aucun avis pour le moment</span
						>
					{/if}
				</div>

				<p class="shop-product-price">
					{#if !selectedVariant && hasDiscount}
						<span class="shop-old"
							>{toTTC(product.compareAtPrice as number, data.vatRate).toFixed(2)} €</span
						>
					{/if}
					{displayedPriceTTC.toFixed(2)} €
				</p>
			</div>

			{#if product.flashSaleEndsAt && data.flashSaleEnabled}
				<FlashSaleCountdown endsAt={product.flashSaleEndsAt} variant="full" />
			{/if}

			<p style="color:var(--shop-text-muted); max-width:48ch;">{product.description}</p>

			<div class="shop-option-group">
				<h4>Couleur</h4>
				<div class="shop-swatches">
					<div
						class="shop-swatch"
						style={`background:${product.colorProduct};`}
						title={product.colorProduct}
					></div>
				</div>
			</div>

			{#if product.variants.length > 0}
				<div class="shop-option-group">
					<h4>Variante</h4>
					<select
						class="shop-sort-select"
						value={selectedVariantId ?? ''}
						onchange={(e) => (selectedVariantId = e.currentTarget.value || null)}
					>
						{#each product.variants as variant (variant.id)}
							<option value={variant.id} disabled={variant.stock <= 0}>
								{variant.label}{variant.stock <= 0 ? ' (rupture)' : ''}
							</option>
						{/each}
					</select>
				</div>
			{/if}

			<div class="shop-option-group">
				<h4>Quantité</h4>
				<div class="shop-qty-stepper">
					<button type="button" aria-label="Diminuer" onclick={decreaseQty}>−</button>
					<input type="text" readonly value={quantity} aria-label="Quantité" />
					<button type="button" aria-label="Augmenter" onclick={increaseQty}>+</button>
				</div>
			</div>

			<div class="shop-product-actions">
				<button
					class="shop-btn shop-btn-block"
					class:shop-btn-success={justAdded}
					disabled={displayedStock <= 0}
					onclick={handleAddToCart}
				>
					{#if justAdded}
						Ajouté ✓
					{:else}
						{displayedStock > 0 ? 'Ajouter au panier' : 'Rupture de stock'}
					{/if}
				</button>
				{#if data.stockAlertsEnabled && product.stock <= 0}
					<button
						type="button"
						class="shop-btn shop-btn-outline"
						disabled={stockAlertBusy}
						onclick={toggleStockAlert}
					>
						{stockAlertSubscribed ? 'Vous serez prévenu' : 'Me prévenir'}
					</button>
				{/if}
				{#if data.wishlistEnabled}
					<button
						type="button"
						class="shop-icon-ph"
						aria-label={inWishlist ? 'Retirer de la liste d’envies' : 'Ajouter à la liste d’envies'}
						disabled={wishlistBusy}
						onclick={toggleWishlist}
					>
						<Heart size={13} fill={inWishlist ? 'currentColor' : 'none'} />
					</button>
				{/if}
			</div>

			<p style="font-size:12px; color:var(--shop-text-muted);">
				{displayedStock > 0
					? `${displayedStock} en stock — expédition sous 5 à 7 jours ouvrés.`
					: 'Actuellement indisponible.'}
			</p>

			<div class="shop-accordion">
				{#each accordionItems as item, i (item.title)}
					<div class="shop-accordion-item">
						<button
							type="button"
							class="shop-accordion-trigger"
							aria-expanded={openPanels[i]}
							onclick={() => togglePanel(i)}
						>
							{item.title} <span class="shop-accordion-icon">+</span>
						</button>
						{#if openPanels[i]}
							<div class="shop-accordion-panel" transition:slide={{ duration: 250 }}>
								<div class="shop-accordion-panel-inner">{item.content}</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>

	{#if data.relatedProducts.length > 0}
		<section class="shop-section">
			<div class="shop-section-head" use:reveal>
				<h2 class="shop-section-title">Vous aimerez aussi</h2>
			</div>
			<div class="shop-grid shop-grid-4">
				{#each data.relatedProducts as related, i (related.id)}
					<ProductCard product={related} index={i} />
				{/each}
			</div>
		</section>
	{/if}

	{#if recentlyViewed.length > 0}
		<section class="shop-section">
			<div class="shop-section-head" use:reveal>
				<h2 class="shop-section-title">Récemment consultés</h2>
			</div>
			<div class="shop-grid shop-grid-4">
				{#each recentlyViewed as viewed, i (viewed.id)}
					<ProductCard
						product={{ ...viewed, images: viewed.image ? [viewed.image] : [] }}
						index={i}
					/>
				{/each}
			</div>
		</section>
	{/if}

	<section class="shop-section" id="reviews">
		<div class="shop-section-head" use:reveal>
			<h2 class="shop-section-title">Avis</h2>
		</div>

		{#if data.user}
			{#if data.hasReviewed}
				<p style="color:var(--shop-text-muted); font-size:14px;">
					Vous avez déjà noté ce produit — merci !
				</p>
			{:else}
				<form
					method="POST"
					action="?/review"
					use:reviewEnhance
					class="shop-form-field"
					style="max-width:420px;"
				>
					<label for="rating-input">Votre note</label>
					<input type="hidden" name="rating" value={$reviewData.rating} />
					<StarRating bind:value={$reviewData.rating} />

					<label for="comment-input">Commentaire (facultatif)</label>
					<textarea id="comment-input" name="comment" bind:value={$reviewData.comment} rows={3}
					></textarea>

					<button type="submit" class="shop-btn" style="margin-top:8px;">Publier l'avis</button>
				</form>
			{/if}
		{:else}
			<p style="color:var(--shop-text-muted); font-size:14px;">
				<a href="/auth/login" style="text-decoration:underline;">Connectez-vous</a> pour laisser un avis.
			</p>
		{/if}

		{#if data.reviews.length === 0}
			<p style="color:var(--shop-text-muted); font-size:14px; margin-top:16px;">
				Soyez le premier à donner votre avis.
			</p>
		{:else}
			<ul style="margin-top:24px; display:flex; flex-direction:column; gap:20px;">
				{#each data.reviews as review (review.id)}
					<li style="border-top:1px solid var(--shop-border); padding-top:16px;">
						<div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
							<StarRating value={review.rating} readonly size="size-3.5" />
							<span style="font-size:13px; font-weight:600;">{review.authorName}</span>
						</div>
						{#if review.comment}
							<p style="font-size:14px; line-height:1.5;">{review.comment}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if data.productQnaEnabled}
		<section class="shop-section">
			<div class="shop-section-head" use:reveal>
				<h2 class="shop-section-title">Questions & réponses</h2>
			</div>

			{#if data.user}
				<form
					method="POST"
					action="?/askQuestion"
					use:askQuestionEnhance
					class="shop-form-field"
					style="max-width:420px;"
				>
					<label for="question-input">Votre question</label>
					<textarea
						id="question-input"
						name="question"
						bind:value={$askQuestionData.question}
						rows={3}
					></textarea>
					<button type="submit" class="shop-btn" style="margin-top:8px;">Envoyer la question</button
					>
				</form>
			{:else}
				<p style="color:var(--shop-text-muted); font-size:14px;">
					<a href="/auth/login" style="text-decoration:underline;">Connectez-vous</a> pour poser une
					question.
				</p>
			{/if}

			{#if data.questions.length === 0}
				<p style="color:var(--shop-text-muted); font-size:14px; margin-top:16px;">
					Aucune question répondue pour ce produit.
				</p>
			{:else}
				<ul style="margin-top:24px; display:flex; flex-direction:column; gap:20px;">
					{#each data.questions as qa (qa.id)}
						<li style="border-top:1px solid var(--shop-border); padding-top:16px;">
							<p style="font-size:14px; font-weight:600;">Q : {qa.question}</p>
							<p style="color:var(--shop-text-muted); font-size:14px; margin-top:4px;">
								R : {qa.answer}
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</main>

<style>
	.shop-badge {
		position: absolute;
		z-index: 3;
		top: 12px;
		left: 12px;
		font-size: 12px;
		font-weight: 700;
		padding: 4px 8px;
		border-radius: 3px;
		background: var(--shop-orange);
		color: var(--shop-ink);
	}
	.shop-product-actions button[disabled] {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.shop-product-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
</style>
