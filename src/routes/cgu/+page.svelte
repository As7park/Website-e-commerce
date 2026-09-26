<script lang="ts">
	import SEO from '$lib/components/SEO.svelte';
	import ShopPage from '$lib/components/shop/ShopPage.svelte';
</script>

<SEO
	title="Conditions générales d'utilisation"
	description="Règles d'usage du site et du contenu déposé par les utilisateurs (avis, questions produit, commentaires)."
/>

<ShopPage
	title="Conditions générales d'utilisation"
	crumbs={[{ label: "Conditions générales d'utilisation" }]}
	width="text"
>
	<div class="shop-prose">
		<p class="text-sm text-muted-foreground">
			⚠️ Modèle à faire valider par un avocat avant mise en production — voir
			<code>CONFORMITE_ECOMMERCE.md</code> à la racine du projet.
		</p>

		<section>
			<h2>1. Objet</h2>
			<p>
				Les présentes conditions générales d'utilisation (CGU) régissent l'accès et l'usage du site
				par tout visiteur, indépendamment de tout achat — voir les
				<a href="/cgv">conditions générales de vente</a> pour les commandes.
			</p>
		</section>

		<section>
			<h2>2. Compte utilisateur</h2>
			<p>
				La création d'un compte requiert une adresse e-mail valide. L'utilisateur est responsable de
				la confidentialité de ses identifiants et de toute activité effectuée depuis son compte. La
				sécurité du compte peut être renforcée par la double authentification, disponible depuis
				l'espace <a href="/auth/settings">Mon compte</a>.
			</p>
		</section>

		<section>
			<h2>3. Contenu déposé par les utilisateurs</h2>
			<p>
				Le site permet de déposer des avis produit, des questions/réponses sur les produits, et des
				commentaires sur les articles du blog. En déposant un contenu, l'utilisateur garantit :
			</p>
			<ul>
				<li>qu'il en est l'auteur ou dispose des droits nécessaires pour le publier ;</li>
				<li>
					qu'il ne contrevient à aucune loi (propos diffamatoires, injurieux, discriminatoires,
					contrefaisants ou manifestement illicites) ;
				</li>
				<li>qu'il se rapporte effectivement au produit ou à l'article concerné (avis sincères).</li>
			</ul>
			<p>
				Le site se réserve le droit de retirer, sans préavis, tout contenu manifestement contraire
				aux présentes CGU ou à la loi, et de suspendre le compte à l'origine d'abus répétés.
			</p>
		</section>

		<section>
			<h2>4. Propriété intellectuelle</h2>
			<p>
				L'ensemble des contenus du site (textes, images, logos, mise en page) est protégé par le
				droit d'auteur — voir les <a href="/mentions-legales">mentions légales</a>. En déposant un
				avis, une question ou un commentaire, l'utilisateur concède au site un droit non exclusif de
				reproduction et de diffusion de ce contenu, dans le cadre de son fonctionnement normal
				(affichage public sur la fiche produit ou l'article concerné).
			</p>
		</section>

		<section>
			<h2>5. Données personnelles</h2>
			<p>
				Le traitement des données personnelles est décrit dans la
				<a href="/confidentialite">politique de confidentialité</a>.
			</p>
		</section>

		<section>
			<h2>6. Droit applicable</h2>
			<p>
				Les présentes CGU sont soumises au droit français. En cas de litige, et à défaut de
				résolution amiable, les tribunaux français seront seuls compétents.
			</p>
		</section>
	</div>
</ShopPage>
