<script lang="ts">
	/* =========================================================
	   RUBAN SÉPARATEUR — deux bandes croisées posées juste avant
	   le pied de page des pages intérieures. Entrent par les
	   côtés quand elles arrivent dans l'écran.
	   ========================================================= */
	import { onMount } from 'svelte';
	import { gsap, onWindow, prefersReducedMotion } from '#lib/shop/fx';
	import Tape from './Tape.svelte';

	let {
		tapes = [['Paiement sécurisé'], ['AS7 Park']]
	}: {
		tapes?: [string[], string[]];
	} = $props();

	let dividerEl: HTMLDivElement;

	onMount(() => {
		if (prefersReducedMotion()) return;
		const ctx = gsap.context(() => {
			gsap.utils.toArray<HTMLElement>('.shop-tape', dividerEl).forEach((tape, i) => {
				gsap.from(tape, {
					xPercent: i ? 12 : -12,
					opacity: 0,
					duration: 1,
					ease: 'power3.out',
					scrollTrigger: onWindow({ trigger: tape, start: 'top 95%' })
				});
			});
		}, dividerEl);
		return () => ctx.revert();
	});
</script>

<div class="shop-pb-divider" bind:this={dividerEl} aria-hidden="true">
	<Tape items={tapes[0]} variant="a" />
	<Tape items={tapes[1]} variant="paper" reverse duration={36} />
</div>
