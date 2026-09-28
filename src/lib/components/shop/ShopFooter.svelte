<script lang="ts">
	import { Instagram, Facebook, MessageCircle } from 'lucide-svelte';
</script>

<footer class="shop-site-footer">
	<div class="shop-container">
		<div class="shop-footer-grid">
			<div class="shop-footer-col">
				<div class="shop-logo" style="margin-bottom:12px;">AS7 PARK</div>
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
