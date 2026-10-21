<script lang="ts">
	/* =========================================================
	   GALERIE HORIZONTALE ÉPINGLÉE — le scroll vertical fait
	   défiler les dalles produits à l'horizontale ; chaque dalle
	   s'incline / se tasse selon sa distance au centre, le halo
	   et le gros texte de fond suivent en parallaxe.
	   Repli (mouvement réduit) : défilement horizontal natif.
	   Porté depuis le bloc "GALERIE HORIZONTALE" de la maquette.
	   ========================================================= */
	import { onMount, type ComponentProps } from 'svelte';
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import { ScrollTrigger, gsap, onWindow, prefersReducedMotion, sectionBg } from '$lib/shop/fx';

	let {
		products,
		eyebrow,
		title,
		bgText,
		link = { label: 'Voir tout', href: '/products' },
		endTitle = 'Toute la boutique',
		endCta = { label: 'Voir tous les articles', href: '/products' },
		bg = '#2a1c07',
		flashSaleEnabled = false
	}: {
		products: ComponentProps<typeof ProductCard>['product'][];
		eyebrow?: string;
		title: string;
		bgText: string;
		link?: { label: string; href: string };
		endTitle?: string;
		endCta?: { label: string; href: string };
		bg?: string;
		flashSaleEnabled?: boolean;
	} = $props();

	let sectionEl: HTMLElement;
	let trackEl: HTMLDivElement;
	let reduced = $state(false);

	onMount(() => {
		if (prefersReducedMotion()) {
			reduced = true;
			return;
		}
		const glow = sectionEl.querySelector<HTMLElement>('.shop-hscroll-glow')!;
		const bgtext = sectionEl.querySelector<HTMLElement>('.shop-hscroll-bgtext')!;
		const bar = sectionEl.querySelector<HTMLElement>('.shop-hscroll-progress i')!;
		const cards = Array.from(trackEl.querySelectorAll<HTMLElement>('.shop-card'));
		// Le repli CSS est un défilement natif ; ici la piste est translatée par GSAP.
		trackEl.style.overflow = 'visible';

		const dist = () => {
			const last = trackEl.lastElementChild as HTMLElement | null;
			if (!last) return 0;
			const pad = parseFloat(getComputedStyle(trackEl).paddingLeft) || 0;
			return Math.max(0, last.offsetLeft + last.offsetWidth + pad - window.innerWidth);
		};

		const update = (p: number) => {
			bar.style.transform = `scaleX(${p})`;
			glow.style.opacity = Math.min(1, p * 6).toFixed(3);
			gsap.set(bgtext, { xPercent: -35 * p });
			const vw = window.innerWidth;
			for (const c of cards) {
				const r = c.getBoundingClientRect();
				const d = (r.left + r.width / 2 - vw / 2) / vw;
				c.style.setProperty('--rot', `${(d * 7).toFixed(2)}deg`);
				c.style.setProperty('--sc', (1 - Math.min(0.12, Math.abs(d) * 0.16)).toFixed(3));
				c.style.setProperty('--py', `${((d * d - 0.12) * 70).toFixed(1)}px`);
			}
		};

		const ctx = gsap.context(() => {
			const tween = gsap.to(trackEl, { x: () => -dist(), ease: 'none' });
			ScrollTrigger.create(
				onWindow({
					trigger: sectionEl,
					start: 'top top',
					end: () => `+=${Math.round(dist() + window.innerHeight * 0.4)}`,
					pin: true,
					scrub: 1,
					anticipatePin: 1,
					animation: tween,
					invalidateOnRefresh: true,
					refreshPriority: 1,
					onUpdate: (self) => update(self.progress),
					onRefresh: (self) => update(self.progress)
				})
			);
			update(0);
		}, sectionEl);

		return () => ctx.revert();
	});
</script>

<div class="shop-hscroll-seam" aria-hidden="true"></div>
<section class="shop-hscroll" class:is-native={reduced} bind:this={sectionEl} use:sectionBg={bg}>
	<div class="shop-hscroll-glow"></div>
	<div class="shop-hscroll-bgtext" aria-hidden="true">{bgText}</div>
	<div class="shop-container shop-hscroll-head">
		<div>
			{#if eyebrow}<p class="shop-eyebrow">{eyebrow}</p>{/if}
			<h2 class="shop-section-title">{title}</h2>
		</div>
		<a href={link.href} class="shop-link">{link.label}</a>
	</div>
	<div class="shop-hscroll-track" class:is-native={reduced} bind:this={trackEl}>
		{#each products as product, i (product.slug)}
			<ProductCard {product} index={i} revealOnScroll={false} {flashSaleEnabled} />
		{/each}
		<div class="shop-hscroll-end">
			<h3>{endTitle}</h3>
			<a href={endCta.href} class="shop-btn shop-btn-light">{endCta.label}</a>
		</div>
	</div>
	<div class="shop-hscroll-progress"><i></i></div>
</section>
