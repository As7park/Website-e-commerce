<script lang="ts">
	/* =========================================================
	   OUVERTURE DE L'ACCUEIL — trois temps qui se chevauchent :
	   1. MaskIntro : on traverse le verre du masque (tear-off).
	   2. RouteBands : Cross / Enduro / Route, écran bloqué.
	   3. Header + hero épinglés ensemble : les bandes s'ouvrent
	      dessus, puis les plaques produits arrivent une par une.
	   Le header de la boutique est rendu ici (la page renvoie
	   `ownHeader`) pour arriver avec le hero plutôt que rester
	   caché tout en haut, derrière l'intro.
	   Intro déjà vue dans la session : on ouvre sur le hero.
	   ========================================================= */
	import { onDestroy, onMount, type ComponentProps, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import ShopHeader from '$lib/components/shop/ShopHeader.svelte';
	import HeroDark from '$lib/components/shop/HeroDark.svelte';
	import MaskIntro from '$lib/components/shop/fx/MaskIntro.svelte';
	import RouteBands, { type RouteAct } from '$lib/components/shop/fx/RouteBands.svelte';
	import { gsap, ScrollTrigger, jumpTo, onWindow, prefersReducedMotion } from '$lib/shop/fx';
	import {
		EXIT,
		HERO_OVERLAP,
		HERO_SPAN,
		LEAVE,
		PLATE,
		REST,
		introSeen,
		markIntroSeen,
		vh
	} from '$lib/shop/intro';

	type HeroProps = Omit<ComponentProps<typeof HeroDark>, 'ctas' | 'staged'>;

	let {
		hero,
		ctas,
		bands,
		mask
	}: {
		hero: HeroProps;
		ctas: Snippet;
		bands: RouteAct[];
		mask: { photo: string; alt: string };
	} = $props();

	let topEl: HTMLDivElement;
	let heroRef: ReturnType<typeof HeroDark>;
	let heroTrigger: ScrollTrigger | undefined;

	/** Position de scroll où les bandes sont ouvertes : header et hero en plein écran. */
	const heroPoint = () => (heroTrigger ? heroTrigger.start + vh(EXIT) : 0);

	function skip() {
		markIntroSeen();
		jumpTo(heroPoint());
	}

	onMount(() => {
		if (prefersReducedMotion()) return;
		const { intro } = heroRef.stage();
		const hero = topEl.querySelector<HTMLElement>('.shop-hero-dark')!;
		const plates = [...hero.querySelectorAll<HTMLElement>('.shop-hero-plate')];

		const ctx = gsap.context(() => {
			gsap.set(plates, { '--iy': '170px', opacity: 0 });
			// L'intro du hero se lance pendant l'ouverture des bandes.
			const introAt = (EXIT * 0.45) / HERO_SPAN;
			let playing = false;
			const h = gsap.timeline({
				defaults: { ease: 'none' },
				scrollTrigger: onWindow({
					trigger: topEl,
					start: 'top top',
					end: () => '+=' + vh(HERO_SPAN),
					pin: true,
					scrub: 0.6,
					anticipatePin: 1,
					refreshPriority: 6,
					invalidateOnRefresh: true,
					onUpdate(self) {
						if (!intro) return;
						if (self.progress > introAt && !playing) {
							playing = true;
							intro.play();
						} else if (self.progress < introAt * 0.5 && playing) {
							playing = false;
							intro.reverse();
						}
					}
				})
			});
			heroTrigger = h.scrollTrigger;
			plates.forEach((pl, i) =>
				h.to(
					pl,
					{ '--iy': '0px', opacity: 1, duration: PLATE * 0.8, ease: 'power3.out' },
					EXIT + i * PLATE
				)
			);
			const out = EXIT + PLATE * 3 + REST;
			h.to(hero.querySelector('.shop-hero-content'), { opacity: 0, duration: LEAVE }, out);
			[-40, -90, -150].forEach((y, i) => {
				if (plates[i]) h.to(plates[i], { '--py': y + 'px', duration: LEAVE }, out);
			});
			h.to(hero.querySelector('.shop-hero-bgword'), { xPercent: -25, duration: LEAVE }, out);
			h.to({}, { duration: 0 }, HERO_SPAN);
		}, topEl);

		return () => {
			heroTrigger = undefined;
			ctx.revert();
		};
	});

	/**
	 * Intro déjà vue : on ouvre directement sur le hero (on peut remonter la
	 * revoir). Les refresh de ScrollTrigger du chargement (images, polices,
	 * `load`) remettent le scroll à sa valeur en cache : on réapplique le saut
	 * après chacun, jusqu'à la première action du visiteur.
	 */
	function openOnHero() {
		const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
		const apply = () => {
			if (heroTrigger) jumpTo(heroPoint());
		};
		const stop = () => {
			ScrollTrigger.removeEventListener('refresh', apply);
			for (const e of events) removeEventListener(e, stop);
			clearTimeout(timer);
		};
		ScrollTrigger.addEventListener('refresh', apply);
		for (const e of events) addEventListener(e, stop, { passive: true });
		const timer = setTimeout(stop, 3000);
		apply();
		return stop;
	}

	// Après la navigation, pour passer après la remise à zéro du scroll de SvelteKit.
	let opened = false;
	let stopOpening: (() => void) | undefined;
	afterNavigate(() => {
		if (opened) return;
		opened = true;
		if (prefersReducedMotion() || !introSeen() || window.location.hash) return;
		if (window.scrollY > 10) return;
		stopOpening = openOnHero();
	});
	onDestroy(() => stopOpening?.());
</script>

<MaskIntro photo={mask.photo} photoAlt={mask.alt} onskip={skip} />
<RouteBands acts={bands} oncomplete={markIntroSeen} />
<div class="shop-home-site" style={`--overlap:${HERO_OVERLAP}vh`}>
	<div class="shop-home-top" bind:this={topEl}>
		<ShopHeader data={page.data} />
		<HeroDark bind:this={heroRef} {...hero} {ctas} staged />
	</div>
</div>

<style>
	.shop-home-site {
		position: relative;
		z-index: 1;
		margin-top: calc(-1 * var(--overlap));
	}
	.shop-home-top {
		position: relative;
		background: #000;
	}
	@media (prefers-reduced-motion: reduce) {
		.shop-home-site {
			margin-top: 0;
		}
	}
</style>
