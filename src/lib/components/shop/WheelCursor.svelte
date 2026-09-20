<script lang="ts">
	/* =========================================================
	   ROUE DE CROSS — curseur de chargement affiché pendant la
	   navigation entre deux pages de la boutique. Se déclenche via
	   l'attribut data-wheel-nav posé sur les cartes cliquables
	   (ProductCard, catégories, dalles du runner) et se referme une
	   fois la navigation SvelteKit terminée. Porté depuis la
	   maquette statique (relais sessionStorage inutile ici : les
	   pages boutique naviguent en client-side via SvelteKit).
	   ========================================================= */
	import { onMount, onDestroy } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { browser } from '$app/environment';

	let cursorEl: HTMLDivElement;
	let visible = $state(false);
	let hideTimeout: ReturnType<typeof setTimeout>;

	function onMouseMove(e: MouseEvent) {
		if (cursorEl) {
			cursorEl.style.transform = `translate(${e.clientX - 17}px, ${e.clientY - 17}px)`;
		}
	}

	function show() {
		visible = true;
		document.documentElement.classList.add('shop-is-loading');
	}

	function hide() {
		visible = false;
		document.documentElement.classList.remove('shop-is-loading');
	}

	function onDocumentClick(e: MouseEvent) {
		const target = (e.target as HTMLElement)?.closest<HTMLAnchorElement>('[data-wheel-nav]');
		if (!target) return;
		const href = target.getAttribute('href');
		if (!href || href === '#') return;
		show();
	}

	onMount(() => {
		window.addEventListener('mousemove', onMouseMove);
		document.addEventListener('click', onDocumentClick, true);
	});

	onDestroy(() => {
		// `onDestroy` s'exécute aussi côté SSR (pas de `window`/`document` là-bas) —
		// voir https://svelte.dev/docs/svelte/svelte#onDestroy.
		if (!browser) return;
		window.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('click', onDocumentClick, true);
		clearTimeout(hideTimeout);
		hide();
	});

	afterNavigate(() => {
		if (!visible) return;
		clearTimeout(hideTimeout);
		hideTimeout = setTimeout(hide, 260);
	});
</script>

<div class="shop-wheel-cursor" class:shop-visible={visible} bind:this={cursorEl} aria-hidden="true">
	<svg viewBox="0 0 100 100" fill="none">
		<circle cx="50" cy="50" r="34" stroke="#ffffff" stroke-width="13" />
		<g stroke="#ffffff" stroke-width="2.4" stroke-linecap="round">
			<line x1="92.0" y1="50.0" x2="96.5" y2="50.0" />
			<line x1="90.6" y1="60.9" x2="94.9" y2="62.0" />
			<line x1="86.4" y1="71.0" x2="90.3" y2="73.2" />
			<line x1="79.7" y1="79.7" x2="82.9" y2="82.9" />
			<line x1="71.0" y1="86.4" x2="73.2" y2="90.3" />
			<line x1="60.9" y1="90.6" x2="62.0" y2="94.9" />
			<line x1="50.0" y1="92.0" x2="50.0" y2="96.5" />
			<line x1="39.1" y1="90.6" x2="38.0" y2="94.9" />
			<line x1="29.0" y1="86.4" x2="26.8" y2="90.3" />
			<line x1="20.3" y1="79.7" x2="17.1" y2="82.9" />
			<line x1="13.6" y1="71.0" x2="9.7" y2="73.2" />
			<line x1="9.4" y1="60.9" x2="5.1" y2="62.0" />
			<line x1="8.0" y1="50.0" x2="3.5" y2="50.0" />
			<line x1="9.4" y1="39.1" x2="5.1" y2="38.0" />
			<line x1="13.6" y1="29.0" x2="9.7" y2="26.7" />
			<line x1="20.3" y1="20.3" x2="17.1" y2="17.1" />
			<line x1="29.0" y1="13.6" x2="26.7" y2="9.7" />
			<line x1="39.1" y1="9.4" x2="38.0" y2="5.1" />
			<line x1="50.0" y1="8.0" x2="50.0" y2="3.5" />
			<line x1="60.9" y1="9.4" x2="62.0" y2="5.1" />
			<line x1="71.0" y1="13.6" x2="73.2" y2="9.7" />
			<line x1="79.7" y1="20.3" x2="82.9" y2="17.1" />
			<line x1="86.4" y1="29.0" x2="90.3" y2="26.7" />
			<line x1="90.6" y1="39.1" x2="94.9" y2="38.0" />
		</g>
		<g stroke="#ffffff" stroke-width="4" stroke-linecap="round">
			<line x1="62.0" y1="50.0" x2="77.0" y2="50.0" />
			<line x1="58.5" y1="58.5" x2="69.1" y2="69.1" />
			<line x1="50.0" y1="62.0" x2="50.0" y2="77.0" />
			<line x1="41.5" y1="58.5" x2="30.9" y2="69.1" />
			<line x1="38.0" y1="50.0" x2="23.0" y2="50.0" />
			<line x1="41.5" y1="41.5" x2="30.9" y2="30.9" />
			<line x1="50.0" y1="38.0" x2="50.0" y2="23.0" />
			<line x1="58.5" y1="41.5" x2="69.1" y2="30.9" />
		</g>
		<circle cx="50" cy="50" r="10" fill="#ffffff" />
		<circle cx="50" cy="50" r="3.4" fill="#000000" />
	</svg>
</div>
