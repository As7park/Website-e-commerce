<script lang="ts">
	/* =========================================================
	   RUNNER DE DALLES PRODUITS — showcase horizontal façon
	   plaques de course : halftone, ombres dures, dossards,
	   éclaboussures de boue au clic. Porté depuis _as7-runner.scss.
	   ========================================================= */
	import { goto } from '$app/navigation';
	import { formatMoney } from '$lib/utils/formatMoney';

	type Product = {
		id: string;
		slug: string;
		name: string;
		price: number;
		images: string[];
		categories: { category: { name: string } }[];
	};

	let {
		products,
		title = 'Sélection',
		accent = 'du moment',
		subtitle = 'Notre sélection du moment.'
	}: {
		products: Product[];
		title?: string;
		accent?: string;
		subtitle?: string;
	} = $props();

	function categoryName(product: Product) {
		return product.categories?.[0]?.category?.name ?? 'Boutique';
	}

	let runnerEl: HTMLDivElement;
	let dragging = $state(false);
	let moved = false;
	let startX = 0;
	let startScroll = 0;

	function onPointerDown(e: PointerEvent) {
		dragging = true;
		moved = false;
		startX = e.clientX;
		startScroll = runnerEl.scrollLeft;
		runnerEl.setPointerCapture(e.pointerId);
	}
	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const dx = e.clientX - startX;
		if (Math.abs(dx) > 5) moved = true;
		runnerEl.scrollLeft = startScroll - dx;
	}
	function onPointerUp() {
		dragging = false;
	}

	/* ---------- Éclaboussures de boue + bump d'impact ---------- */
	function randomBlobRadius() {
		const r = () => 35 + Math.floor(Math.random() * 45);
		return `${r()}% ${r()}% ${r()}% ${r()}% / ${r()}% ${r()}% ${r()}% ${r()}%`;
	}

	function buildSplatPiece(isDrop: boolean): HTMLSpanElement {
		const el = document.createElement('span');
		el.className = isDrop ? 'splat-drop' : 'splat-blob';
		if (!isDrop && Math.random() < 0.5) el.classList.add('has-drip');

		const size = isDrop ? 6 + Math.random() * 8 : 20 + Math.random() * 26;
		el.style.width = `${size.toFixed(1)}px`;
		el.style.height = `${size.toFixed(1)}px`;
		el.style.left = `${(Math.random() * 84).toFixed(1)}%`;
		el.style.top = `${(Math.random() * 60).toFixed(1)}%`;
		el.style.setProperty('--rot', `${(Math.random() * 360).toFixed(0)}deg`);
		el.style.setProperty('--d', `${(Math.random() * 0.22).toFixed(2)}s`);
		if (!isDrop) el.style.borderRadius = randomBlobRadius();

		return el;
	}

	function spawnSplat(card: HTMLElement) {
		const layer = card.querySelector<HTMLElement>('.splat-layer');
		if (layer) {
			layer.innerHTML = '';
			const count = 5 + Math.floor(Math.random() * 3);
			for (let i = 0; i < count; i++) {
				layer.appendChild(buildSplatPiece(Math.random() < 0.4));
			}
		}
		card.classList.add('impact');
		setTimeout(() => card.classList.remove('impact'), 340);
	}

	function handleCardClick(e: MouseEvent, href: string) {
		if (moved) {
			e.preventDefault();
			return;
		}
		e.preventDefault();
		const card = e.currentTarget as HTMLElement;
		spawnSplat(card);
		setTimeout(() => goto(href), 360);
	}
</script>

<section class="stage">
	<div class="grain"></div>
	<div class="speedlines"></div>

	<header class="head">
		<div>
			<h1>{title} <em>{accent}</em></h1>
			<p class="sub">{subtitle}</p>
		</div>
		<div class="drag-hint">
			<svg viewBox="0 0 26 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
				<path
					d="M1 7h22m0 0l-6-6m6 6l-6 6"
					stroke="currentColor"
					stroke-width="2"
					fill="none"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			Glisser pour explorer
		</div>
	</header>

	<div class="runner-wrap">
		<div
			class="runner"
			class:grabbing={dragging}
			bind:this={runnerEl}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointerleave={onPointerUp}
		>
			{#each products as product, i (product.id)}
				<a
					class="card"
					href={`/products/${product.slug}`}
					data-wheel-nav
					onclick={(e) => handleCardClick(e, `/products/${product.slug}`)}
				>
					<div class="plate">
						<div class="tagrow">
							<span class="category">{categoryName(product)}</span>
							<span class="bib">{String(i + 1).padStart(2, '0')}</span>
						</div>
						<div class="art">
							{#if product.images?.[0]}
								<img src={product.images[0]} alt={product.name} loading="lazy" />
							{:else}
								<svg viewBox="0 0 40 40" aria-hidden="true">
									<rect x="13" y="6" width="14" height="30" rx="3" />
									<path d="M16 6v-2h8v2" />
								</svg>
							{/if}
							<span class="burst">
								<svg viewBox="0 0 46 46" fill="currentColor" aria-hidden="true">
									<path
										d="M23 2l4 12 12-6-6 12 12 4-12 4 6 12-12-6-4 12-4-12-12 6 6-12-12-4 12-4-6-12 12 6z"
									/>
								</svg>
							</span>
						</div>
						<h3 class="name">{product.name}</h3>
						<div class="tag-wrap">
							<div class="price-tag"><span class="price">{formatMoney(product.price)}</span></div>
						</div>
						<div class="splat-layer"></div>
					</div>
				</a>
			{/each}
		</div>
	</div>

	<div class="rail"><div class="rail-bar"></div></div>
</section>

<style lang="scss">
	// =========================================================================
	// RUNNER DE DALLES PRODUITS
	// Porté depuis _as7-runner.scss, scopé automatiquement par Svelte à ce
	// composant (aucune classe ne fuit vers le reste de l'application).
	// =========================================================================

	$ink: #14120f;
	$panel: #1d1a15;
	$paper: #f2efe4;
	$orange: #ff5a1f;
	$acid: #c9f04d;
	$dust: #8a6f52;
	$rust: #7a2e12;

	$font-display: 'Staatliches', sans-serif;
	$font-body: 'Space Grotesk', sans-serif;

	.stage {
		--ink: #{$ink};
		--panel: #{$panel};
		--paper: #{$paper};
		--orange: #{$orange};
		--acid: #{$acid};
		--dust: #{$dust};
		--rust: #{$rust};

		position: relative;
		padding: 6.5rem 0 5rem;
		background:
			radial-gradient(ellipse 900px 500px at 12% -10%, rgba(255, 90, 31, 0.14), transparent 60%),
			var(--ink);
		overflow: hidden;
		color: var(--paper);
		font-family: $font-body;
		-webkit-font-smoothing: antialiased;
	}

	.grain {
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0.05;
		mix-blend-mode: overlay;
		z-index: 1;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
	}

	.speedlines {
		position: absolute;
		inset: -20% -10%;
		background-image: repeating-linear-gradient(
			100deg,
			rgba(242, 239, 228, 0.035) 0px,
			rgba(242, 239, 228, 0.035) 2px,
			transparent 2px,
			transparent 68px
		);
		z-index: 0;

		@media (prefers-reduced-motion: no-preference) {
			animation: drift 34s linear infinite;
		}
	}

	@keyframes drift {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-240px);
		}
	}

	header.head {
		position: relative;
		z-index: 2;
		max-width: 1180px;
		margin: 0 auto 3.4rem;
		padding: 0 2.5rem;
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 2rem;
		flex-wrap: wrap;

		@media (max-width: 640px) {
			padding: 0 1.3rem;
			align-items: flex-start;
		}
	}

	h1 {
		font-family: $font-display;
		font-weight: 400;
		font-size: clamp(2.6rem, 6vw, 4.4rem);
		line-height: 0.92;
		margin: 0;
		letter-spacing: 0.5px;
		color: var(--paper);

		em {
			font-style: normal;
			color: var(--orange);
		}
	}

	.sub {
		max-width: 360px;
		font-size: 0.98rem;
		line-height: 1.5;
		color: var(--dust);
		margin: 0;
	}

	.drag-hint {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.78rem;
		color: var(--dust);
		letter-spacing: 0.02em;

		svg {
			width: 26px;
			height: 14px;
		}

		@media (prefers-reduced-motion: no-preference) {
			svg path {
				animation: nudge 1.6s ease-in-out infinite;
			}
		}
	}

	@keyframes nudge {
		0%,
		100% {
			transform: translateX(0);
		}
		50% {
			transform: translateX(5px);
		}
	}

	.runner-wrap {
		position: relative;
		z-index: 2;
		-webkit-mask-image: linear-gradient(90deg, transparent 0, #000 4%, #000 96%, transparent 100%);
		mask-image: linear-gradient(90deg, transparent 0, #000 4%, #000 96%, transparent 100%);
	}

	.runner {
		display: flex;
		gap: 2.6rem;
		padding: 2.2rem 2.5rem 3rem;
		overflow-x: auto;
		scroll-snap-type: x proximity;
		cursor: grab;
		user-select: none;
		scrollbar-width: none;

		&::-webkit-scrollbar {
			display: none;
		}
		&.grabbing {
			cursor: grabbing;
		}

		@media (max-width: 640px) {
			padding: 2rem 1.3rem 2.6rem;
			gap: 1.6rem;
		}
	}

	.card {
		display: block;
		position: relative;
		flex: 0 0 auto;
		width: 248px;
		scroll-snap-align: start;
		cursor: pointer;
		transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
		color: inherit;
		text-decoration: none;

		&:nth-child(odd) {
			transform: rotate(-1.6deg);
		}
		&:nth-child(even) {
			transform: rotate(1.3deg);
		}
		&:hover {
			transform: rotate(0deg) translateY(-6px);
		}

		&:nth-child(3n + 2) {
			--shadow-c: var(--acid);
		}
		&:nth-child(3n) {
			--shadow-c: var(--rust);
		}

		@media (max-width: 640px) {
			width: 208px;
		}

		&:focus-visible .plate {
			outline: 3px solid var(--acid);
			outline-offset: 3px;
		}

		@media (prefers-reduced-motion: no-preference) {
			&.impact .plate {
				animation: impactBump 0.32s ease;
			}
		}
	}

	@keyframes impactBump {
		0% {
			transform: scale(1);
		}
		30% {
			transform: scale(0.96);
		}
		60% {
			transform: scale(1.02);
		}
		100% {
			transform: scale(1);
		}
	}

	.plate {
		position: relative;
		background: var(--panel);
		border: 2px solid var(--paper);
		clip-path: polygon(0 0, calc(100% - 26px) 0, 100% 26px, 100% 100%, 0 100%);
		padding: 1.1rem 1.1rem 1.3rem;
		box-shadow: 7px 7px 0 var(--shadow-c, var(--orange));
		overflow: hidden;
		transition:
			box-shadow 0.35s ease,
			transform 0.35s ease;

		.card:hover & {
			box-shadow: 11px 11px 0 var(--shadow-c, var(--orange));
		}
	}

	.splat-layer {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 56%;
		overflow: visible;
		pointer-events: none;
		z-index: 4;
	}

	.splat-blob {
		position: absolute;
		background:
			radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.07), transparent 42%),
			radial-gradient(circle at 60% 70%, #0a0806 0%, #030202 75%);
		border-radius: 58% 42% 63% 37% / 55% 40% 60% 45%;
		box-shadow:
			0 0 0 1px rgba(138, 111, 82, 0.22),
			0 3px 6px rgba(0, 0, 0, 0.45);
		transform: scale(0) rotate(var(--rot, 0deg));
		opacity: 0;
		animation: splatPop 0.42s cubic-bezier(0.22, 1.4, 0.4, 1) forwards;
		animation-delay: var(--d, 0s);

		&.has-drip::after {
			content: '';
			position: absolute;
			left: 48%;
			top: 90%;
			width: 26%;
			height: 0;
			background: #040302;
			border-radius: 0 0 50% 50%;
			box-shadow: 0 0 0 1px rgba(138, 111, 82, 0.18);
			transform: translateX(-50%);
			animation: dripGrow 0.5s ease forwards;
			animation-delay: calc(var(--d, 0s) + 0.14s);
		}
	}

	.splat-drop {
		position: absolute;
		background: #040302;
		border-radius: 50%;
		box-shadow: 0 0 0 1px rgba(138, 111, 82, 0.18);
		transform: scale(0) rotate(var(--rot, 0deg));
		opacity: 0;
		animation: splatPop 0.3s cubic-bezier(0.22, 1.4, 0.4, 1) forwards;
		animation-delay: var(--d, 0s);
	}

	@keyframes splatPop {
		0% {
			transform: scale(0) rotate(var(--rot, 0deg));
			opacity: 0;
		}
		60% {
			transform: scale(1.18) rotate(var(--rot, 0deg));
			opacity: 1;
		}
		100% {
			transform: scale(1) rotate(var(--rot, 0deg));
			opacity: 0.95;
		}
	}

	@keyframes dripGrow {
		from {
			height: 0;
			opacity: 0.9;
		}
		to {
			height: 13px;
			opacity: 0.85;
		}
	}

	.tagrow {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.6rem;
	}

	.category {
		font-size: 0.72rem;
		letter-spacing: 0.03em;
		color: var(--dust);
	}

	.bib {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 2px solid var(--ink);
		background: var(--shadow-c, var(--orange));
		color: var(--ink);
		font-family: $font-display;
		font-size: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transform: rotate(-6deg);
		flex: 0 0 auto;
	}

	.art {
		position: relative;
		height: 148px;
		border: 1.5px dashed rgba(242, 239, 228, 0.25);
		background:
			radial-gradient(circle, rgba(242, 239, 228, 0.16) 1px, transparent 1.3px) 0 0 / 10px 10px,
			#17140f;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		margin-bottom: 0.9rem;

		svg {
			width: 76%;
			height: 76%;
			stroke: var(--paper);
			fill: none;
			stroke-width: 2.4;
			stroke-linecap: round;
			stroke-linejoin: round;
			filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.35));
		}

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.burst {
		position: absolute;
		top: -14px;
		left: -14px;
		width: 46px;
		height: 46px;
		color: var(--shadow-c, var(--orange));
		transform: scale(0) rotate(-20deg);
		opacity: 0;
		transition:
			transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1),
			opacity 0.25s ease;
		pointer-events: none;
		z-index: 3;

		.card:hover & {
			transform: scale(1) rotate(0deg);
			opacity: 1;
		}
	}

	h3.name {
		font-family: $font-display;
		font-weight: 400;
		font-size: 1.32rem;
		letter-spacing: 0.3px;
		margin: 0 0 0.8rem;
		color: var(--paper);
	}

	.tag-wrap {
		display: flex;
		justify-content: flex-end;
	}

	.price-tag {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.32rem 0.7rem 0.32rem 0.55rem;
		border: 1.5px dashed var(--dust);
		border-radius: 3px;
		transform: rotate(2.5deg);
		background: rgba(242, 239, 228, 0.03);

		&::before {
			content: '';
			width: 6px;
			height: 6px;
			border-radius: 50%;
			border: 1.5px solid var(--dust);
			background: var(--ink);
		}
	}

	.price {
		font-family: $font-body;
		font-weight: 700;
		font-size: 0.98rem;
		color: var(--acid);
	}

	.rail {
		position: relative;
		z-index: 2;
		max-width: 1180px;
		margin: 0 auto;
		padding: 0 2.5rem;

		@media (max-width: 640px) {
			padding: 0 1.3rem;
		}
	}

	.rail-bar {
		height: 10px;
		border-top: 2px solid rgba(242, 239, 228, 0.2);
		border-bottom: 2px solid rgba(242, 239, 228, 0.2);
		background-image: repeating-linear-gradient(
			90deg,
			rgba(242, 239, 228, 0.35) 0,
			rgba(242, 239, 228, 0.35) 2px,
			transparent 2px,
			transparent 34px
		);
		background-position: center;
	}
</style>
