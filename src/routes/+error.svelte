<script lang="ts">
	import { page } from '$app/stores';
	import SEO from '$lib/components/SEO.svelte';

	let notFound = $derived($page.status === 404);
</script>

<!-- SEO pour la page d'erreur -->
<SEO pageKey="error" />

{#if $page.url.pathname.startsWith('/admin')}
	<!-- Admin : garde le thème du back-office. -->
	<div class="flex min-h-screen items-center justify-center">
		<div class="text-center">
			<h1 class="text-6xl font-bold">{$page.status}</h1>
			<p class="mt-2 text-lg text-muted-foreground">
				{$page.error?.message || 'Une erreur est survenue.'}
			</p>
			<a href="/admin" class="mt-6 inline-block underline">Retour au tableau de bord</a>
		</div>
	</div>
{:else}
	<main class="shop-container shop-page shop-error">
		<p class="shop-error-code">{$page.status}</p>
		<h1 class="shop-page-title">
			{notFound ? 'Page introuvable' : 'Une erreur est survenue'}
		</h1>
		<p class="shop-page-lead">
			{notFound
				? "La page que vous cherchez n'existe pas ou a été déplacée."
				: $page.error?.message || 'Merci de réessayer dans quelques instants.'}
		</p>
		<div class="shop-error-actions">
			<a href="/" class="shop-btn">Retour à l'accueil</a>
			<a href="/products" class="shop-btn shop-btn-outline">Voir la boutique</a>
		</div>
	</main>
{/if}
