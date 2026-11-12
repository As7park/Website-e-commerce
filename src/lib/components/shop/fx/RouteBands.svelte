<script lang="ts" module>
	export type RouteAct = {
		name: string;
		line: string;
		cta: string;
		href: string;
		img: string;
		/** `object-position` de la photo. */
		pos?: string;
	};
</script>

<script lang="ts">
	/* =========================================================
	   TROIS BANDES — Cross, Enduro, Route, écran bloqué.
	   Noir et blanc au repos ; à chaque cran une bande s'élargit
	   et passe en couleur par un volet vertical, les autres
	   montent ou descendent. Sortie : elles s'ouvrent sur le hero
	   (voir HomeOpening). Le bloc remonte sous l'intro masque,
	   qui se dissout par-dessus pendant DISSOLVE vh.
	   ========================================================= */
	import { onMount } from 'svelte';
	import { gsap, onWindow, prefersReducedMotion } from '#lib/shop/fx';
	import { BANDS_SPAN, DISSOLVE, EXIT, HOLD, INTRO, MOVE } from '#lib/shop/intro';

	let {
		acts,
		title = 'Choisis ta route',
		oncomplete
	}: {
		/** Exactement trois univers. */
		acts: RouteAct[];
		title?: string;
		/** Appelé quand on arrive au bout de la séquence. */
		oncomplete?: () => void;
	} = $props();

	// Sens de chaque bande : -1 monte, +1 descend.
	const DIR = [-1, 1, -1];
	const OFF = 7;

	let wrapEl: HTMLDivElement;
	let headEl: HTMLHeadingElement;
	const bands: HTMLElement[] = $state([]);
	const colors: HTMLDivElement[] = $state([]);
	const photos: HTMLDivElement[] = $state([]);
	const titles: HTMLHeadingElement[] = $state([]);
	const mores: HTMLDivElement[] = $state([]);

	onMount(() => {
		if (prefersReducedMotion()) return;
		const clipOf = (i: number) => (DIR[i] < 0 ? 'inset(100% 0 0 0)' : 'inset(0 0 100% 0)');
		const OPEN = 'inset(0% 0 0% 0)';
		// Écran en hauteur : bandes empilées, elles glissent à l'horizontale.
		const tall = matchMedia('(max-aspect-ratio: 4/5)').matches;
		const shift = (v: number) => (tall ? { xPercent: v } : { yPercent: v });

		const ctx = gsap.context(() => {
			acts.forEach((_, i) => {
				gsap.set(bands[i], { ...shift(DIR[i] * OFF), flexGrow: 1 });
				gsap.set(colors[i], { clipPath: clipOf(i) });
				gsap.set(titles[i], { scale: 0.62, transformOrigin: '0 100%' });
				gsap.set(mores[i], { autoAlpha: 0, y: 24 });
			});

			const tl = gsap.timeline({
				defaults: { ease: 'none' },
				scrollTrigger: onWindow({
					trigger: wrapEl,
					start: () => 'top+=' + (innerHeight * DISSOLVE) / 100 + ' top',
					end: () => '+=' + (innerHeight * BANDS_SPAN) / 100,
					scrub: 0.6,
					invalidateOnRefresh: true,
					onLeave: () => oncomplete?.()
				})
			});

			// Dérive continue des photos, en sens opposé selon la bande.
			acts.forEach((_, i) => {
				tl.fromTo(
					photos[i],
					{ yPercent: DIR[i] * 5 },
					{ yPercent: -DIR[i] * 5, duration: BANDS_SPAN },
					0
				);
			});

			let at = INTRO;
			tl.to(headEl, { autoAlpha: 0, y: -40, duration: MOVE * 0.6, ease: 'power2.in' }, at);
			acts.forEach((_, active) => {
				const prev = active - 1;
				const ease = 'power3.inOut';
				tl.to(bands[active], { flexGrow: 2.7, ...shift(0), duration: MOVE, ease }, at);
				tl.to(colors[active], { clipPath: OPEN, duration: MOVE, ease }, at);
				tl.to(titles[active], { scale: 1, duration: MOVE, ease }, at);
				tl.to(
					mores[active],
					{ autoAlpha: 1, y: 0, duration: MOVE * 0.5, ease: 'power2.out' },
					at + MOVE * 0.5
				);
				if (prev >= 0) {
					tl.to(bands[prev], { flexGrow: 1, ...shift(-DIR[prev] * OFF), duration: MOVE, ease }, at);
					tl.to(
						colors[prev],
						{
							clipPath: DIR[prev] < 0 ? 'inset(0 0 100% 0)' : 'inset(100% 0 0 0)',
							duration: MOVE,
							ease
						},
						at
					);
					tl.to(titles[prev], { scale: 0.62, duration: MOVE, ease }, at);
					tl.to(
						mores[prev],
						{ autoAlpha: 0, y: -18, duration: MOVE * 0.35, ease: 'power2.in' },
						at
					);
				}
				// Les bandes qui attendent changent de hauteur, à contresens.
				acts.forEach((_, i) => {
					if (i !== active && i !== prev)
						tl.to(bands[i], { ...shift(-DIR[i] * OFF), duration: MOVE, ease }, at);
				});
				at += MOVE + HOLD;
			});

			// Ouverture sur le hero : deux bandes montent, une descend.
			acts.forEach((_, i) => {
				tl.to(mores[i], { autoAlpha: 0, duration: EXIT * 0.2 }, at);
				tl.to(bands[i], { ...shift(DIR[i] * 112), duration: EXIT, ease: 'power3.in' }, at + i * 3);
			});
			tl.to({}, { duration: 0 }, BANDS_SPAN);
		}, wrapEl);

		return () => ctx.revert();
	});
</script>

<div
	class="shop-route-bands"
	bind:this={wrapEl}
	style={`height:${100 + DISSOLVE + BANDS_SPAN}vh;margin-top:-${100 + DISSOLVE}vh`}
>
	<section class="screen" aria-label={title}>
		<div class="row">
			{#each acts as act, i (act.name)}
				<article class="band" bind:this={bands[i]}>
					<div class="photo" bind:this={photos[i]}>
						<img
							class="bw"
							src={act.img}
							alt=""
							style={`object-position:${act.pos ?? '50% 50%'}`}
						/>
						<div class="color" bind:this={colors[i]}>
							<img src={act.img} alt={act.name} style={`object-position:${act.pos ?? '50% 50%'}`} />
						</div>
					</div>
					<div class="veil"></div>
					<div class="copy">
						<span class="idx">0{i + 1} / 0{acts.length}</span>
						<h2 bind:this={titles[i]}>{act.name}</h2>
						<div class="more" bind:this={mores[i]}>
							<p>{act.line}</p>
							<a href={act.href} class="shop-btn shop-btn-light" data-wheel-nav>{act.cta}</a>
						</div>
					</div>
				</article>
			{/each}
		</div>
		<h2 class="head" bind:this={headEl}>{title}</h2>
	</section>
</div>

<style>
	.shop-route-bands {
		position: relative;
		z-index: 2;
		pointer-events: none;
	}
	.screen {
		position: sticky;
		top: 0;
		height: 100vh;
		overflow: hidden;
		background: transparent;
	}
	.row {
		position: absolute;
		inset: 0;
		display: flex;
		gap: 3px;
	}
	.band {
		position: relative;
		flex: 1 1 0;
		min-width: 0;
		min-height: 0;
		height: 100%;
		overflow: hidden;
		background: #000;
		will-change: transform;
	}
	.photo {
		position: absolute;
		left: 50%;
		top: -8%;
		width: 70vw;
		height: 116%;
		margin-left: -35vw;
		will-change: transform;
	}
	.photo img,
	.color {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		max-width: none;
	}
	.photo img {
		object-fit: cover;
	}
	.bw {
		filter: grayscale(1) contrast(1.12) brightness(0.6);
	}
	.color {
		will-change: clip-path;
	}
	.veil {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent 46%, rgba(0, 0, 0, 0.78) 100%);
		pointer-events: none;
	}
	.copy {
		position: absolute;
		left: clamp(16px, 2.4vw, 36px);
		right: clamp(16px, 2.4vw, 36px);
		bottom: clamp(24px, 6vh, 64px);
		color: #fff;
	}
	.idx {
		display: block;
		margin-bottom: 8px;
		font: 400 0.95rem/1 var(--shop-font-label);
		letter-spacing: 0.18em;
		color: rgba(255, 255, 255, 0.72);
	}
	h2 {
		margin: 0;
		font: 400 clamp(3.4rem, 8vw, 9.5rem) / 0.88 var(--shop-font-display);
		text-transform: uppercase;
		color: #fff;
	}
	.more {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 24px;
		margin-top: 16px;
	}
	.more p {
		margin: 0;
		font-size: clamp(1rem, 1.25vw, 1.25rem);
		color: rgba(255, 255, 255, 0.86);
	}
	.more a {
		pointer-events: auto;
	}
	.head {
		position: absolute;
		left: clamp(16px, 2.4vw, 36px);
		top: clamp(22px, 4.4vh, 44px);
		font-size: clamp(2.2rem, 4.2vw, 5rem);
	}

	/* Écran en hauteur : les bandes s'empilent et s'étirent en hauteur. */
	@media (max-aspect-ratio: 4/5) {
		.row {
			flex-direction: column;
		}
		.band {
			width: 100%;
			height: auto;
		}
		.photo {
			left: -8%;
			top: 50%;
			width: 116%;
			height: 70vh;
			margin-left: 0;
			margin-top: -35vh;
		}
		h2 {
			font-size: clamp(2.6rem, 13vw, 5rem);
		}
		.head {
			font-size: clamp(1.8rem, 8vw, 3rem);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.shop-route-bands {
			display: none;
		}
	}
</style>
