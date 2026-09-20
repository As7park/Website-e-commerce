<script lang="ts">
	import { page } from '$app/stores';
	import { User } from 'lucide-svelte';
	import Cart from '$lib/components/cart/Cart.svelte';
	import SearchDialog from '$lib/components/shop/SearchDialog.svelte';

	// AUTH-PLUGIN : lien compte adapté selon la session (login vs espace client).
	let { data } = $props();
	let accountHref = $derived(data?.user ? '/auth/settings' : '/auth/login');
</script>

<header class="shop-site-header">
	<div class="shop-announcement-bar">Livraison offerte dès 50€ d'achat</div>
	<div class="shop-header-main">
		<a href="/" class="shop-logo">MadeInDiamonds</a>
		<nav class="shop-main-nav">
			<ul>
				<li>
					<a href="/" class:shop-active={$page.url.pathname === '/'}>Accueil</a>
				</li>
				<li>
					<a href="/products" class:shop-active={$page.url.pathname.startsWith('/products')}
						>Boutique</a
					>
				</li>
				<!-- BLOG-PLUGIN -->
				<li>
					<a href="/blog" class:shop-active={$page.url.pathname.startsWith('/blog')}>Blog</a>
				</li>
				<!-- BLOG-PLUGIN -->
				<!-- CONTACT-PLUGIN -->
				<li>
					<a href="/contact" class:shop-active={$page.url.pathname === '/contact'}>Contact</a>
				</li>
				<!-- CONTACT-PLUGIN -->
			</ul>
		</nav>
		<div class="shop-header-actions">
			<SearchDialog />
			<!-- AUTH-PLUGIN -->
			<a href={accountHref} aria-label="Compte" class="shop-icon-ph">
				<User size={13} strokeWidth={2} />
			</a>
			<!-- AUTH-PLUGIN -->
			<!-- COMMERCE-PLUGIN : tiroir panier partagé avec le reste du site. -->
			<div class="shop-cart-slot">
				<Cart {data} variant="shop" />
			</div>
			<!-- COMMERCE-PLUGIN -->
		</div>
	</div>
</header>
