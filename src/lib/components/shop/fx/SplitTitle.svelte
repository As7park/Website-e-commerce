<script lang="ts">
	/**
	 * Titre découpé mot par mot (chaque mot masqué dans `.shop-w`) pour
	 * l'intro "mots qui montent" du hero et des bandeaux de page. `accent`
	 * est rendu dans un `<em>` (couleur d'accent), comme dans la maquette.
	 */
	let { text, accent = '' }: { text: string; accent?: string } = $props();

	const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
	// Espace sécable entre deux mots (une espace littérale en bord de bloc serait supprimée).
	const SPACE = ' ';
</script>

<!-- eslint-disable svelte/require-each-key -- listes de mots statiques -->
{#each words(text) as word}<span class="shop-w"><span class="shop-wi">{word}</span></span
	>{SPACE}{/each}{#if accent}<em
		>{#each words(accent) as word, i}{#if i}{SPACE}{/if}<span class="shop-w"
				><span class="shop-wi">{word}</span></span
			>{/each}</em
	>{/if}
