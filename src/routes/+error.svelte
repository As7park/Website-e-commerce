<script lang="ts">
	import { page } from '$app/state';
	import SEO from '#lib/components/SEO.svelte';

	// Le statut était codé en dur à « 404 » : une panne serveur s'affichait donc
	// comme une page introuvable, envoyant l'utilisateur chercher une faute
	// d'URL au lieu de réessayer ou de nous contacter.
	const status = $derived(page.status);
	const isNotFound = $derived(status === 404);
	const message = $derived(
		isNotFound
			? "Cette page n'existe pas ou a été déplacée."
			: 'Une erreur est survenue de notre côté. Réessayez dans un instant ; si le problème persiste, contactez-nous.'
	);
</script>

<!-- SEO pour la page d'erreur -->
<SEO pageKey="error" />

{#if page.url.pathname.startsWith('/admin')}
	<!-- Admin : garde le thème du back-office. -->
	<div class="flex min-h-screen items-center justify-center">
		<div class="text-center">
			<h1 class="text-6xl font-bold">{status}</h1>
			<p class="mt-2 text-lg text-muted-foreground">
				{page.error?.message || 'Une erreur est survenue.'}
			</p>
			<a href="/admin" class="mt-6 inline-block underline">Retour au tableau de bord</a>
		</div>
	</div>
{:else}
	<main class="shop-container shop-page shop-error">
		<p class="shop-error-code">{status}</p>
		<h1 class="shop-page-title">
			{isNotFound ? 'Page introuvable' : 'Une erreur est survenue'}
		</h1>
		<p class="shop-page-lead">
			{message}
		</p>
		<div class="shop-error-actions">
			<a href="/" class="shop-btn">Retour à l'accueil</a>
			<a href="/products" class="shop-btn shop-btn-outline">Voir la boutique</a>
		</div>
	</main>
{/if}
