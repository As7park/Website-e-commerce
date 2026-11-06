<script lang="ts">
	import { Instagram, Facebook, MessageCircle } from 'lucide-svelte';
</script>

<footer class="shop-site-footer">
	<div class="shop-container">
		<img
			class="shop-footer-roundel"
			src="/brand/roundel-white.svg"
			alt=""
			width="120"
			height="110"
			loading="lazy"
		/>
		<div class="shop-footer-grid">
			<div class="shop-footer-col">
				<img
					class="shop-footer-wordmark"
					src="/brand/wordmark-white.svg"
					alt="AS7 Park"
					width="186"
					height="42"
					loading="lazy"
				/>
				<img
					class="shop-footer-tagline"
					src="/brand/tagline-white.svg"
					alt="Made by riders for riders"
					width="180"
					height="25"
					loading="lazy"
				/>
				<p>Boutique moto en ligne — équipement pilote, pièces et accessoires.</p>
			</div>
			<div class="shop-footer-col">
				<h4>Boutique</h4>
				<ul>
					<li><a href="/products">Toute la boutique</a></li>
					<li><a href="/">Nouveautés</a></li>
				</ul>
			</div>
			<div class="shop-footer-col">
				<h4>Aide</h4>
				<ul>
					<li><a href="/contact">Contact</a></li>
					<li><a href="/checkout">Mon panier</a></li>
				</ul>
			</div>
			<div class="shop-footer-col">
				<h4>Légal</h4>
				<ul>
					<li><a href="/mentions-legales">Mentions légales</a></li>
					<li><a href="/cgv">CGV</a></li>
					<li><a href="/cgu">CGU</a></li>
					<li><a href="/confidentialite">Confidentialité</a></li>
				</ul>
			</div>
		</div>
		<div class="shop-footer-bottom">
			<p>© {new Date().getFullYear()} AS7 Park</p>
			<p class="shop-footer-designed">Designed in France</p>
			<div class="shop-social-row">
				<a
					class="shop-icon-ph"
					href="https://www.instagram.com/as7park/"
					target="_blank"
					rel="noopener noreferrer"
					aria-label="Instagram"><Instagram size={13} /></a
				>
				<a
					class="shop-icon-ph"
					href="https://www.facebook.com/as7park/"
					target="_blank"
					rel="noopener noreferrer"
					aria-label="Facebook"><Facebook size={13} /></a
				>
				<a class="shop-icon-ph" href="#" aria-label="WhatsApp"><MessageCircle size={13} /></a>
			</div>
		</div>
	</div>
</footer>
