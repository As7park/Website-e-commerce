<script lang="ts">
	import { resetCart } from '$lib/store/Data/cartStore';
	import SEO from '$lib/components/SEO.svelte';

	// On reset le panier dès que la page est consultée
	$effect(() => {
		resetCart(); // Vide le panier et affiche un toast de succès
	});
</script>

<!-- Page transactionnelle, jamais de valeur SEO -->
<SEO pageKey="checkoutSuccess" noindex nofollow />

<main class="shop-container">
	<div
		style="min-height:60vh; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; gap:16px; padding:32px;"
	>
		<h1 class="shop-section-title">Merci pour votre commande !</h1>
		<p style="color:var(--shop-text-muted); max-width:48ch;">
			Votre commande a bien été prise en compte. Un email de confirmation va vous être envoyé.
		</p>
		<div
			style="display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:12px;"
		>
			<a href="/" class="shop-btn">Retour à l'accueil</a>
			<a href="/suivi-commande" class="shop-btn shop-btn-outline">Suivre ma commande</a>
		</div>
	</div>
</main>
