<script lang="ts">
	/* =========================================================
	   RUBAN — bande de texte qui défile en continu (hero, bandeaux
	   de page, séparateur avant le pied de page). La vitesse
	   s'emballe avec le scroll, comme dans la maquette.
	   ========================================================= */
	import { onMount } from 'svelte';
	import { gsap, getScrollDelta, prefersReducedMotion } from '#lib/shop/fx';

	let {
		items,
		variant = 'a',
		reverse = false,
		duration = 32
	}: {
		items: string[];
		/** `a` = ambre, `b` = acide, `paper` = clair. */
		variant?: 'a' | 'b' | 'paper';
		reverse?: boolean;
		duration?: number;
	} = $props();

	// Deux moitiés identiques : la boucle translate de -50 % sans saut.
	const REPEAT = 8;
	let sequence = $derived(Array.from({ length: REPEAT }, () => items).flat());

	let trackEl: HTMLDivElement;

	onMount(() => {
		if (prefersReducedMotion()) return;
		const tween = gsap.fromTo(
			trackEl,
			{ xPercent: reverse ? -50 : 0 },
			{ xPercent: reverse ? 0 : -50, duration, ease: 'none', repeat: -1 }
		);
		let boost = 0;
		const tick = () => {
			boost += (Math.min(14, Math.abs(getScrollDelta()) * 0.23) - boost) * 0.08;
			tween.timeScale(1 + boost);
		};
		gsap.ticker.add(tick);
		return () => {
			gsap.ticker.remove(tick);
			tween.kill();
		};
	});
</script>

<div class="shop-tape shop-tape-{variant}" aria-hidden="true">
	<div class="shop-tape-track" bind:this={trackEl}>
		<!-- eslint-disable-next-line svelte/require-each-key -- répétition purement décorative -->
		{#each sequence as item}<span>{item}</span><i>//</i>{/each}
	</div>
</div>
