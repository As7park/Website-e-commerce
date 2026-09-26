<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Gabarit commun des pages publiques hors vitrine (auth, compte client,
	 * pages légales, suivi) : fil d'Ariane, conteneur et titre identiques à
	 * ceux de la boutique, pour que tout le site se lise comme un ensemble.
	 *
	 * `width` : `narrow` (formulaires courts, auth), `text` (lecture longue,
	 * pages légales), `wide` (pleine largeur du conteneur).
	 */
	let {
		title,
		lead,
		crumbs = [],
		width = 'wide',
		children
	}: {
		title: string;
		lead?: string;
		crumbs?: { label: string; href?: string }[];
		width?: 'narrow' | 'text' | 'wide';
		children: Snippet;
	} = $props();
</script>

<nav class="shop-breadcrumb" aria-label="Fil d'Ariane">
	<a href="/">Accueil</a>
	{#each crumbs as crumb (crumb.label)}
		/
		{#if crumb.href}<a href={crumb.href}>{crumb.label}</a>{:else}{crumb.label}{/if}
	{/each}
</nav>

<main class="shop-container shop-page">
	<div
		class="shop-page-inner"
		class:is-narrow={width === 'narrow'}
		class:is-text={width === 'text'}
	>
		<header class="shop-page-head">
			<h1 class="shop-page-title">{title}</h1>
			{#if lead}<p class="shop-page-lead">{lead}</p>{/if}
		</header>
		{@render children()}
	</div>
</main>
