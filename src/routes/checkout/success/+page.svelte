<script lang="ts">
	import { resetCart } from '$lib/store/Data/cartStore';
	import SEO from '$lib/components/SEO.svelte';

	// On reset le panier dès que la page est consultée
	$effect(() => {
		resetCart(); // Vide le panier et affiche un toast de succès
	});
</script>

<!-- SEO pour la page de succès -->
<SEO pageKey="checkoutSuccess" />

<div class="min-h-screen w-[100vw]">
	<div class="min-h-screen flex flex-col justify-center items-center text-center p-8">
		<h1 class="text-3xl font-bold mb-4">Merci pour votre commande !</h1>
		<p class="text-lg mb-6">
			Votre commande a bien été prise en compte. Un email de confirmation va vous être envoyé.
		</p>
		<div class="flex flex-wrap items-center justify-center gap-3">
			<a href="/" class="px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition">
				Retour à l'accueil
			</a>
			<a
				href="/suivi-commande"
				class="px-6 py-3 rounded-xl border border-black hover:bg-gray-100 transition"
			>
				Suivre ma commande
			</a>
		</div>
	</div>
</div>
