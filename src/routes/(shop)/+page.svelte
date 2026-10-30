<script lang="ts">
	import HeroDark from '#lib/components/shop/HeroDark.svelte';
	import ProductRunner from '#lib/components/shop/ProductRunner.svelte';
	import CubeBand from '#lib/components/shop/fx/CubeBand.svelte';
	import HorizontalGallery from '#lib/components/shop/fx/HorizontalGallery.svelte';
	import SEO from '#lib/components/SEO.svelte';
	import { reveal } from '#lib/actions/reveal';
	import { splatCard } from '#lib/actions/splatCard';
	import { gridParallax, sectionBg } from '#lib/shop/fx';
	import { Truck, RotateCcw, ShieldCheck, Headset } from 'lucide-svelte';

	let { data } = $props();

	const valueProps = [
		{ icon: Truck, text: 'Livraison sous 5 à 7 jours ouvrés' },
		{ icon: RotateCcw, text: 'Retours sous 14 jours' },
		{ icon: ShieldCheck, text: 'Paiement sécurisé par Stripe' },
		{ icon: Headset, text: 'Service client réactif' }
	];

	const pad = (n: number) => String(n).padStart(2, '0');
	let heroStats = $derived([
		{ value: pad(data.stats.products), label: data.stats.products > 1 ? 'Produits' : 'Produit' },
		{
			value: pad(data.stats.categories),
			label: data.stats.categories > 1 ? 'Catégories' : 'Catégorie'
		},
		{ value: '14 J', label: 'Pour changer d’avis' }
	]);
</script>

<SEO pageKey="home" />

<main>
	<HeroDark
		eyebrow="Cross · Enduro · Route"
		title="Équipez-vous"
		accent="pour rouler."
		text="Équipement pilote, pièces et accessoires moto sélectionnés par des passionnés, pour la piste comme pour la route."
		stats={heroStats}
		plates={data.featuredProducts}
		bgWord="AS7 PARK"
		hud={['N°01 — Collection', String(new Date().getFullYear())]}
		tapes={[
			['Nouveautés', 'Livraison offerte dès 50 €'],
			['Cross', 'Enduro', 'Route']
		]}
	>
		{#snippet ctas()}
			<a href="/products" class="shop-btn shop-btn-light">Découvrir la boutique</a>
			<a href="/contact" class="shop-btn shop-btn-outline-light">Nous contacter</a>
		{/snippet}
	</HeroDark>

	<CubeBand
		pinned
		bgText="Collection"
		rowItems={['AS7 Park', 'Équipez-vous pour rouler']}
		hudLabel="AS7 Park — Équipement moto"
		captions={[
			{ title: 'Livraison 5 à 7 jours', text: 'Expédié rapidement, offerte dès 50 € d’achat.' },
			{
				title: 'Retours 14 jours',
				text: 'Pas la bonne taille ? Vous avez 14 jours pour changer d’avis.'
			},
			{ title: 'Paiement sécurisé', text: 'Réglez en toute confiance, paiement géré par Stripe.' }
		]}
	/>

	<div class="shop-container" use:sectionBg={'#14120F'}>
		<section class="shop-section">
			<div class="shop-section-head" use:reveal>
				<h2 class="shop-section-title">Catégories</h2>
				<a href="/products" class="shop-link">Voir tout</a>
			</div>
			{#if data.categories.length > 0}
				<div class="shop-grid shop-grid-4" use:gridParallax>
					{#each data.categories as category, i (category.id)}
						<a
							class="shop-card"
							href={`/products?${data.categoryFilterSlug}=${encodeURIComponent(category.value)}`}
							data-wheel-nav
							use:splatCard
							use:reveal={{ delay: i * 70 }}
						>
							<div class="shop-ph shop-ph-square">{category.name}</div>
							<p class="shop-card-title">{category.name}</p>
						</a>
					{/each}
				</div>
			{:else}
				<p style="color:var(--shop-text-muted);">Aucune catégorie pour le moment.</p>
			{/if}
		</section>
	</div>

	{#if data.featuredProducts.length > 0}
		<ProductRunner
			products={data.featuredProducts}
			title="Nouveautés"
			subtitle="Une sélection qui bouge vite — glisse pour tout voir."
		/>
	{/if}

	{#if data.selectionProducts.length > 0}
		<HorizontalGallery
			products={data.selectionProducts}
			eyebrow="Le choix de l’atelier"
			title="Sélection du moment"
			bgText="Sélection"
			flashSaleEnabled={data.flashSaleEnabled}
		/>
	{/if}

	<div class="shop-container" use:sectionBg={'#171b0d'}>
		<section class="shop-section">
			<div class="shop-value-props">
				{#each valueProps as prop, i (prop.text)}
					<div class="shop-value-prop" use:reveal={{ delay: i * 90 }}>
						<span class="shop-icon-ph"><prop.icon size={13} /></span>
						<p>{prop.text}</p>
					</div>
				{/each}
			</div>
		</section>
	</div>

	<section class="shop-newsletter" use:reveal>
		<h2 class="shop-section-title" style="margin:0;">Restez informés</h2>
		<p style="color:var(--shop-text-muted); margin:8px 0 0;">
			Recevez nos nouveautés, conseils d’entretien et offres en avant-première.
		</p>
		<form class="shop-newsletter-form" onsubmit={(e) => e.preventDefault()}>
			<input type="email" placeholder="Adresse e-mail" aria-label="Adresse e-mail" required />
			<button type="submit" class="shop-btn">S'inscrire</button>
		</form>
	</section>
</main>
