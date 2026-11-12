<script lang="ts" module>
	import type { gsap } from 'gsap';

	/**
	 * Anime l'habillage d'une section bloquée (voir `pinHold`) : le mot
	 * glisse, le logo tourne, la trame monte, la barre se remplit et le
	 * compteur suit les éléments dévoilés (`total` à partir de `from`,
	 * un tous les `step`). Durées en vh, comme la timeline.
	 */
	export function dressDeco(
		tl: gsap.core.Timeline,
		host: HTMLElement,
		{ length, from = 0, step = 0 }: { length: number; from?: number; step?: number }
	) {
		const q = (s: string) => host.querySelector<HTMLElement>(`:scope > .shop-deco ${s}`);
		const word = q('.shop-deco-word');
		const round = q('.shop-deco-round');
		const dots = q('.shop-deco-dots');
		if (word) tl.to(word, { xPercent: -24, duration: length }, 0);
		if (round) tl.to(round, { rotation: 110, duration: length }, 0);
		if (dots) tl.to(dots, { yPercent: -16, duration: length }, 0);
		const bar = q('.shop-deco-bar i');
		if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: length }, 0);
		const count = q('.shop-deco-count b');
		const total = Number(count?.dataset.total ?? 0);
		if (count && total && step) {
			const o = { n: 0 };
			tl.to(
				o,
				{
					n: total,
					duration: step * total,
					onUpdate() {
						count.textContent = String(Math.ceil(o.n)).padStart(2, '0');
					}
				},
				from
			);
		}
	}
</script>

<script lang="ts">
	/* =========================================================
	   HABILLAGE DES SECTIONS BLANCHES — le langage des sections
	   noires, en négatif : mot géant détouré, lignes de vitesse,
	   trame, halo orange, logo rond ; et pour les sections
	   bloquées, HUD, tagline, compteur et barre de progression.
	   À poser en premier enfant d'une section `position:relative`.
	   ========================================================= */
	let {
		word,
		hud,
		total = 0
	}: {
		/** Mot géant en fond. */
		word: string;
		/** Légende en haut à gauche ; active aussi tagline, compteur et barre. */
		hud?: string;
		/** Nombre d'éléments comptés (compteur `00 / 04`). */
		total?: number;
	} = $props();

	const pad = (n: number) => String(n).padStart(2, '0');
</script>

<div class="shop-deco" aria-hidden="true">
	<div class="shop-deco-lines"></div>
	<div class="shop-deco-dots"></div>
	<div class="shop-deco-glow"></div>
	<div class="shop-deco-word">{word}</div>
	<img class="shop-deco-round" src="/brand/roundel-black.svg" alt="" />
	{#if hud}
		<div class="shop-deco-hud">{hud}</div>
		<img class="shop-deco-tag" src="/brand/tagline-black.svg" alt="" />
		{#if total}
			<div class="shop-deco-count"><b data-total={total}>00</b> / {pad(total)}</div>
		{/if}
		<div class="shop-deco-bar"><i></i></div>
	{/if}
</div>
