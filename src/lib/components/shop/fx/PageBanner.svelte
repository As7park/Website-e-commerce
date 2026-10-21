<script lang="ts">
	/* =========================================================
	   BANDEAU DE PAGE (pages intérieures) — poussière canvas 2D
	   qui tourbillonne autour de la souris, faisceau, mot géant
	   en contour, numéro de page, HUD fil d'Ariane, rubans.
	   Intro mot par mot + parallaxe souris/scroll. Porté depuis
	   le bloc "PAGE BANNER FX" de la maquette.
	   ========================================================= */
	import { onMount } from 'svelte';
	import { gsap, onWindow, prefersReducedMotion, sectionBg } from '$lib/shop/fx';
	import SplitTitle from './SplitTitle.svelte';
	import Tape from './Tape.svelte';

	type Chip = { label: string; href?: string; hot?: boolean };

	let {
		word,
		num,
		crumbs = [],
		eyebrow,
		title,
		accent = '',
		titleTag = 'h1',
		lead,
		chips = [],
		tapes,
		slim = false,
		bg = '#14120F'
	}: {
		/** Mot géant en contour, en fond. */
		word: string;
		/** Numéro de page en contour (01, 02…). */
		num: string;
		/** Fil d'Ariane après « Accueil ». */
		crumbs?: { label: string; href?: string }[];
		eyebrow?: string;
		title: string;
		accent?: string;
		/** `p` quand la page porte déjà son propre `<h1>` (fiche produit). */
		titleTag?: 'h1' | 'p';
		lead?: string;
		chips?: Chip[];
		/** Textes des deux rubans du bas (ambre puis acide). */
		tapes: [string[], string[]];
		slim?: boolean;
		bg?: string;
	} = $props();

	const year = new Date().getFullYear();

	let bannerEl: HTMLElement;
	let dustEl: HTMLCanvasElement;

	onMount(() => {
		const reduce = prefersReducedMotion();
		const cleanups: Array<() => void> = [];

		/* ---------- poussière fine (canvas 2D) ---------- */
		const cx = dustEl.getContext('2d');
		if (cx && !reduce) {
			const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
			const N = 260;
			const mouse = { x: -9999, y: -9999, vx: 0, vy: 0 };
			type Particle = {
				x: number;
				y: number;
				z: number;
				vx: number;
				vy: number;
				r: number;
				ph: number;
			};
			const P: Particle[] = [];
			let W = 0;
			let H = 0;
			let visible = true;

			const size = () => {
				W = bannerEl.clientWidth;
				H = bannerEl.clientHeight;
				dustEl.width = W * dpr;
				dustEl.height = H * dpr;
				cx.setTransform(dpr, 0, 0, dpr, 0, 0);
			};
			const spawn = (p: Partial<Particle>, anywhere: boolean): Particle => {
				p.x = Math.random() * W;
				p.y = anywhere ? Math.random() * H : -10;
				p.z = Math.random();
				p.vx = (Math.random() - 0.3) * 0.12;
				p.vy = 0.05 + Math.random() * 0.22;
				p.r = 0.4 + p.z * 1.1;
				p.ph = Math.random() * 6.28;
				return p as Particle;
			};
			size();
			for (let i = 0; i < N; i++) P.push(spawn({}, true));

			const resizeObserver = new ResizeObserver(size);
			resizeObserver.observe(bannerEl);
			const intersectionObserver = new IntersectionObserver((es) => {
				visible = es[0].isIntersecting;
			});
			intersectionObserver.observe(bannerEl);

			const onMove = (e: MouseEvent) => {
				const r = bannerEl.getBoundingClientRect();
				const nx = e.clientX - r.left;
				const ny = e.clientY - r.top;
				mouse.vx = nx - mouse.x;
				mouse.vy = ny - mouse.y;
				mouse.x = nx;
				mouse.y = ny;
			};
			const onLeave = () => {
				mouse.x = mouse.y = -9999;
			};
			bannerEl.addEventListener('mousemove', onMove);
			bannerEl.addEventListener('mouseleave', onLeave);

			const t0 = performance.now();
			let rafId = 0;
			const loop = (now: number) => {
				rafId = requestAnimationFrame(loop);
				if (!visible) return;
				const t = (now - t0) / 1000;
				cx.clearRect(0, 0, W, H);
				// Source de lumière : devant, en haut à droite.
				const lx = W * 0.74;
				const ly = H * 0.1;
				for (const p of P) {
					const dx = p.x - mouse.x;
					const dy = p.y - mouse.y;
					const d2 = dx * dx + dy * dy;
					if (d2 < 24000) {
						// Volute : force tangentielle autour de la souris.
						const d = Math.sqrt(d2) + 1;
						const f = (1 - d / 155) * 0.55;
						p.vx += (-dy / d) * f * 0.5 + mouse.vx * 0.004;
						p.vy += (dx / d) * f * 0.5 + mouse.vy * 0.004;
					}
					p.vx += Math.sin(t * 0.5 + p.ph + p.y * 0.01) * 0.003;
					p.vx *= 0.985;
					p.vy += (0.05 + p.z * 0.2 - p.vy) * 0.01;
					p.x += p.vx * (0.6 + p.z);
					p.y += p.vy * (0.6 + p.z);
					if (p.y > H + 10 || p.x < -20 || p.x > W + 20) spawn(p, false);
					const ld = Math.hypot(p.x - lx, p.y - ly) / (W * 0.8);
					const a = Math.max(0.05, 0.62 - ld) * (0.35 + p.z * 0.65);
					cx.fillStyle = `rgba(${(235 + p.z * 20) | 0},${(205 + p.z * 25) | 0},${(165 + p.z * 20) | 0},${a.toFixed(3)})`;
					cx.beginPath();
					cx.arc(p.x, p.y, p.r, 0, 6.2832);
					cx.fill();
				}
				mouse.vx *= 0.8;
				mouse.vy *= 0.8;
			};
			rafId = requestAnimationFrame(loop);

			cleanups.push(() => {
				cancelAnimationFrame(rafId);
				resizeObserver.disconnect();
				intersectionObserver.disconnect();
				bannerEl.removeEventListener('mousemove', onMove);
				bannerEl.removeEventListener('mouseleave', onLeave);
			});
		}

		if (reduce) return () => cleanups.forEach((fn) => fn());

		/* ---------- intro + parallaxe ---------- */
		const ctx = gsap.context(() => {
			const q = gsap.utils.selector(bannerEl);
			const intro = gsap.timeline({ defaults: { ease: 'power4.out' } });
			intro
				.from(q('.shop-pb-eyebrow'), { y: 22, opacity: 0, duration: 0.7 }, 0.1)
				.from(q('.shop-pb-title .shop-wi'), { yPercent: 118, duration: 1.1, stagger: 0.07 }, 0.15)
				.from(
					q('.shop-pb-lead, .shop-pb-chips > *'),
					{ y: 26, opacity: 0, duration: 0.8, stagger: 0.08 },
					0.7
				)
				.from(q('.shop-pb-tape .shop-tape'), { yPercent: 130, duration: 1, stagger: 0.12 }, 0.5)
				.from(q('.shop-pb-num'), { yPercent: 40, opacity: 0, rotate: 18, duration: 1.2 }, 0.3)
				.from(q('.shop-pb-hud'), { opacity: 0, duration: 1 }, 1);

			// Parallaxe souris par profondeur.
			const [wordEl] = q('.shop-pb-word');
			const [numEl] = q('.shop-pb-num');
			const qw = gsap.quickTo(wordEl, 'x', { duration: 1, ease: 'power3' });
			const qn = gsap.quickTo(numEl, 'x', { duration: 1, ease: 'power3' });
			const qny = gsap.quickTo(numEl, 'y', { duration: 1, ease: 'power3' });
			const onMove = (e: MouseEvent) => {
				const r = bannerEl.getBoundingClientRect();
				const nx = (e.clientX - r.left) / r.width - 0.5;
				const ny = (e.clientY - r.top) / r.height - 0.5;
				qw(nx * -40);
				qn(nx * -90);
				qny(ny * -50);
			};
			bannerEl.addEventListener('mousemove', onMove);
			cleanups.push(() => bannerEl.removeEventListener('mousemove', onMove));

			// Parallaxe scroll.
			const scrub = onWindow({
				trigger: bannerEl,
				start: 'top top',
				end: 'bottom top',
				scrub: true
			});
			gsap.to(wordEl, { xPercent: -22, ease: 'none', scrollTrigger: scrub });
			gsap.to(q('.shop-pb-glow'), { yPercent: 40, ease: 'none', scrollTrigger: { ...scrub } });
			gsap.to(q('.shop-pb-inner'), {
				yPercent: -18,
				opacity: 0,
				ease: 'none',
				scrollTrigger: onWindow({
					trigger: bannerEl,
					start: '40% top',
					end: 'bottom top',
					scrub: true
				})
			});
		}, bannerEl);

		return () => {
			ctx.revert();
			cleanups.forEach((fn) => fn());
		};
	});
</script>

<section class="shop-pbanner" class:is-slim={slim} bind:this={bannerEl} use:sectionBg={bg}>
	<canvas class="shop-pb-dust" bind:this={dustEl} aria-hidden="true"></canvas>
	<div class="shop-pb-vig"></div>
	<div class="shop-pb-speed"></div>
	<div class="shop-pb-glow"></div>
	<div class="shop-pb-beam"><i></i></div>
	<div class="shop-pb-word" aria-hidden="true">{word}</div>
	<div class="shop-pb-num" aria-hidden="true">{num}</div>
	<div class="shop-pb-hud is-tl">
		<nav class="shop-pb-crumbs" aria-label="Fil d'Ariane">
			<a href="/">Accueil</a>
			{#each crumbs as crumb (crumb.label)}
				/
				{#if crumb.href}<a href={crumb.href}>{crumb.label}</a>{:else}{crumb.label}{/if}
			{/each}
		</nav>
	</div>
	<div class="shop-pb-hud is-tr" aria-hidden="true">{year}</div>
	<div class="shop-container shop-pb-inner">
		{#if eyebrow}<p class="shop-pb-eyebrow">{eyebrow}</p>{/if}
		<svelte:element this={titleTag} class="shop-pb-title">
			<SplitTitle text={title} {accent} />
		</svelte:element>
		{#if lead}<p class="shop-pb-lead">{lead}</p>{/if}
		{#if chips.length}
			<div class="shop-pb-chips">
				{#each chips as chip (chip.label)}
					{#if chip.href}
						<a href={chip.href} class="shop-pb-chip" class:is-hot={chip.hot}>{chip.label}</a>
					{:else}
						<span class="shop-pb-chip" class:is-hot={chip.hot}>{chip.label}</span>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
	<div class="shop-pb-tape">
		<Tape items={tapes[0]} variant="a" />
		<Tape items={tapes[1]} variant="b" reverse duration={36} />
	</div>
</section>
