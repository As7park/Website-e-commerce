<script lang="ts">
	import HomeOpening from '#lib/components/shop/HomeOpening.svelte';
	import ShopDeco, { dressDeco } from '#lib/components/shop/fx/ShopDeco.svelte';
	import type { RouteAct } from '#lib/components/shop/fx/RouteBands.svelte';
	import ProductRunner from '#lib/components/shop/ProductRunner.svelte';
	import CubeBand from '#lib/components/shop/fx/CubeBand.svelte';
	import HorizontalGallery from '#lib/components/shop/fx/HorizontalGallery.svelte';
	import SEO from '#lib/components/SEO.svelte';
	import { reveal } from '#lib/actions/reveal';
	import { splatCard } from '#lib/actions/splatCard';
	import { gsap, onWindow, pinHold, prefersReducedMotion } from '#lib/shop/fx';
	import maskPhoto from '#lib/assets/home/mask.jpg';
	import bandCross from '#lib/assets/home/band-cross.jpg';
	import bandEnduro from '#lib/assets/home/band-enduro.jpg';
	import bandRoute from '#lib/assets/home/band-route.jpg';
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

	/* Photos provisoires (recherches pour la maquette) : à remplacer par celles du client. */
	const mask = {
		photo: maskPhoto,
		alt: 'Pilote de motocross en pleine courbe, projetant une gerbe de terre'
	};

	/** Lien vers la boutique filtrée sur l'univers, s'il existe dans la taxonomie. */
	function universeHref(name: string) {
		const match = data.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
		return match
			? `/products?${data.categoryFilterSlug}=${encodeURIComponent(match.value)}`
			: '/products';
	}
	let bands: RouteAct[] = $derived([
		{
			name: 'Cross',
			line: 'Équipement pilote pour la piste.',
			cta: 'Voir cross',
			href: universeHref('Cross'),
			img: bandCross,
			pos: '58% 50%'
		},
		{
			name: 'Enduro',
			line: 'Pièces et accessoires pour le terrain.',
			cta: 'Voir enduro',
			href: universeHref('Enduro'),
			img: bandEnduro,
			pos: '32% 50%'
		},
		{
			name: 'Route',
			line: 'Une sélection pensée pour la route.',
			cta: 'Voir route',
			href: universeHref('Route'),
			img: bandRoute,
			pos: '42% 50%'
		}
	]);

	/* Sections bloquées : durées en vh de scroll. Priorités dans l'ordre de la page
	   (hero 6, cube 5, catégories 4, nouveautés 3, galerie 2, réassurance 1). */
	const shut = 'inset(0 0 100% 0)';
	const open = 'inset(0 0 0% 0)';

	/** Catégories : elles se dévoilent une à une, puis restent à l'écran. */
	const catsHold = {
		length: 280,
		priority: 4,
		build(tl: gsap.core.Timeline, node: HTMLElement) {
			dressDeco(tl, node, { length: 280, from: 10, step: 30 });
			node.querySelectorAll<HTMLElement>('.shop-card').forEach((el, i) => {
				const at = 10 + i * 30;
				tl.fromTo(el, { clipPath: shut }, { clipPath: open, duration: 30, ease: 'power2.out' }, at);
				const img = el.querySelector('img');
				if (img)
					tl.fromTo(
						img,
						{ filter: 'grayscale(1) contrast(1.1)', scale: 1.16 },
						{ filter: 'grayscale(0) contrast(1)', scale: 1, duration: 34, ease: 'power2.inOut' },
						at + 8
					);
			});
		}
	};

	/** Nouveautés : le bloc reste en place et les plaques défilent. */
	const newsHold = {
		length: 300,
		priority: 3,
		build(tl: gsap.core.Timeline, node: HTMLElement) {
			const runner = node.querySelector<HTMLElement>('.runner');
			if (!runner) return;
			// L'aimantation du défilement contrarierait le pilotage au scroll.
			gsap.set(runner, { scrollSnapType: 'none' });
			tl.to(
				runner,
				{ scrollLeft: () => runner.scrollWidth - runner.clientWidth, duration: 210 },
				45
			);
		}
	};

	/** Réassurance : les engagements arrivent l'un après l'autre. */
	const valuesHold = {
		length: 220,
		priority: 1,
		build(tl: gsap.core.Timeline, node: HTMLElement) {
			dressDeco(tl, node, { length: 220, from: 10, step: 30 });
			node.querySelectorAll<HTMLElement>('.shop-value-prop').forEach((el, i) => {
				tl.fromTo(
					el,
					{ clipPath: shut },
					{ clipPath: open, duration: 30, ease: 'power2.out' },
					10 + i * 30
				);
			});
		}
	};

	/** Newsletter : même habillage, en parallaxe simple. */
	function decoDrift(node: HTMLElement) {
		if (prefersReducedMotion()) return {};
		const ctx = gsap.context(() => {
			const st = () =>
				onWindow({ trigger: node, start: 'top bottom', end: 'bottom top', scrub: true });
			gsap.to('.shop-deco-word', { xPercent: -20, ease: 'none', scrollTrigger: st() });
			gsap.to('.shop-deco-round', { rotation: 80, ease: 'none', scrollTrigger: st() });
		}, node);
		return { destroy: () => ctx.revert() };
	}
</script>

<SEO pageKey="home" />

<main>
	<HomeOpening
		{mask}
		{bands}
		hero={{
			eyebrow: 'Cross · Enduro · Route',
			title: 'Équipez-vous',
			accent: 'pour rouler.',
			text: 'Équipement pilote, pièces et accessoires moto sélectionnés par des passionnés, pour la piste comme pour la route.',
			stats: heroStats,
			plates: data.featuredProducts,
			bgWord: 'AS7 PARK',
			hud: ['N°01 — Collection', String(new Date().getFullYear())]
		}}
	>
		{#snippet ctas()}
			<a href="/products" class="shop-btn shop-btn-light">Découvrir la boutique</a>
			<a href="/contact" class="shop-btn shop-btn-outline-light">Nous contacter</a>
		{/snippet}
	</HomeOpening>

	<CubeBand
		pinned
		bgText="Collection"
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

	<div class="shop-light shop-home-cats shop-decorated" use:pinHold={catsHold}>
		<ShopDeco
			word="Catégories"
			hud="AS7 Park — Choisis ton univers"
			total={Math.min(data.categories.length, 4)}
		/>
		<div class="shop-container">
			<section class="shop-section">
				<div class="shop-section-head" use:reveal>
					<h2 class="shop-section-title">Catégories</h2>
					<a href="/products" class="shop-link">Voir tout</a>
				</div>
				{#if data.categories.length > 0}
					<div class="shop-grid shop-grid-4">
						{#each data.categories as category (category.id)}
							<a
								class="shop-card"
								href={`/products?${data.categoryFilterSlug}=${encodeURIComponent(category.value)}`}
								data-wheel-nav
								use:splatCard
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
	</div>

	{#if data.featuredProducts.length > 0}
		<div use:pinHold={newsHold}>
			<ProductRunner
				products={data.featuredProducts}
				title="Nouveautés"
				subtitle="Une sélection qui bouge vite — glisse pour tout voir."
			/>
		</div>
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

	<div class="shop-light">
		<div class="shop-container shop-home-values shop-decorated" use:pinHold={valuesHold}>
			<ShopDeco word="AS7 Park" hud="AS7 Park — Roulez tranquille" total={valueProps.length} />
			<section class="shop-section">
				<div class="shop-value-props">
					{#each valueProps as prop, i (prop.text)}
						<div class="shop-value-prop">
							<span class="shop-value-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
							<span class="shop-icon-ph"><prop.icon size={13} /></span>
							<p>{prop.text}</p>
						</div>
					{/each}
				</div>
			</section>
		</div>

		<section class="shop-newsletter shop-home-newsletter shop-decorated" use:decoDrift>
			<ShopDeco word="Restez informés" />
			<h2 class="shop-section-title" style="margin:0;">Restez informés</h2>
			<p style="color:var(--shop-text-muted); margin:8px 0 0;">
				Recevez nos nouveautés, conseils d’entretien et offres en avant-première.
			</p>
			<form class="shop-newsletter-form" onsubmit={(e) => e.preventDefault()}>
				<input type="email" placeholder="Adresse e-mail" aria-label="Adresse e-mail" required />
				<button type="submit" class="shop-btn">S'inscrire</button>
			</form>
		</section>
	</div>
</main>
