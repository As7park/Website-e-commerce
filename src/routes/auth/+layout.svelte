<script lang="ts">
	import SEO from '$lib/components/SEO.svelte';

	let { children } = $props();
</script>

<!-- Aucune page sous /auth n'a de valeur SEO : ce sont soit des flux
     fonctionnels (connexion, inscription, mot de passe...), soit des pages
     privées une fois connecté (compte, paramètres). `noindex` posé une
     seule fois ici plutôt que de compter sur chaque sous-page, actuelle ou
     future, pour y penser. -->
<SEO noindex nofollow />

{@render children()}
