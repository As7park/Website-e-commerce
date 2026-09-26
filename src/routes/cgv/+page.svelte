<script lang="ts">
	import SEO from '$lib/components/SEO.svelte';
	import ShopPage from '$lib/components/shop/ShopPage.svelte';
</script>

<SEO
	title="Conditions générales de vente"
	description="Modalités de commande, paiement, livraison, rétractation et garanties applicables aux achats sur ce site."
/>

<ShopPage
	title="Conditions générales de vente"
	crumbs={[{ label: 'Conditions générales de vente' }]}
	width="text"
>
	<div class="shop-prose">
		<p class="text-sm text-muted-foreground">
			⚠️ Modèle à faire valider par un avocat/expert-comptable avant mise en production — voir
			<code>CONFORMITE_ECOMMERCE.md</code> à la racine du projet.
		</p>

		<section>
			<h2>1. Objet</h2>
			<p>
				Les présentes conditions générales de vente (CGV) régissent les ventes de produits réalisées
				sur ce site entre le vendeur (voir <a href="/mentions-legales">mentions légales</a>) et tout
				consommateur ou professionnel effectuant un achat (le « client »). Toute commande implique
				l'acceptation sans réserve des présentes CGV.
			</p>
		</section>

		<section>
			<h2>2. Prix</h2>
			<p>
				Les prix sont indiqués en euros, toutes taxes comprises (TTC). Le taux de TVA applicable est
				celui en vigueur au jour de la commande. Le vendeur se réserve le droit de modifier ses prix
				à tout moment, les produits étant facturés sur la base des tarifs en vigueur au moment de la
				validation de la commande.
			</p>
		</section>

		<section>
			<h2>3. Commande et paiement</h2>
			<p>
				La commande est définitive après validation du paiement. Le paiement s'effectue en ligne par
				carte bancaire, via la solution sécurisée Stripe. Aucune donnée bancaire ne transite ni
				n'est stockée par le vendeur — la sécurité du paiement (norme PCI-DSS, authentification
				forte du client) est intégralement assurée par Stripe.
			</p>
		</section>

		<section>
			<h2>4. Livraison</h2>
			<p>
				Les commandes sont expédiées via Sendcloud, vers l'adresse indiquée par le client au moment
				de la commande. Un e-mail de confirmation puis de suivi est envoyé à chaque étape. À défaut
				de livraison dans le délai indiqué, le client peut, après mise en demeure restée sans effet,
				résoudre la vente dans les conditions prévues aux articles L216-2 à L216-6 du Code de la
				consommation.
			</p>
		</section>

		<section>
			<h2>5. Droit de rétractation</h2>
			<p>
				Conformément aux articles L221-18 et suivants du Code de la consommation, le client
				consommateur dispose d'un délai de <strong>14 jours</strong> à compter de la réception de sa
				commande pour exercer son droit de rétractation, sans avoir à justifier de motif ni à supporter
				d'autres frais que ceux de retour du produit. Le remboursement, incluant les frais de livraison
				standard, est effectué dans un délai de 14 jours suivant la réception du produit retourné.
			</p>
			<p>
				Conformément à l'article L221-28, 3° du Code de la consommation, le droit de rétractation
				<strong>ne s'applique pas</strong> aux produits confectionnés selon les spécifications du client
				ou nettement personnalisés (gravure, sur-mesure).
			</p>
			<p>
				La demande de rétractation s'effectue depuis l'espace client, à la page de la facture
				concernée.
			</p>
		</section>

		<section>
			<h2>6. Garanties légales</h2>
			<p>
				Tout produit vendu bénéficie de la garantie légale de conformité (articles L217-3 et
				suivants du Code de la consommation) et de la garantie légale contre les vices cachés
				(articles 1641 et suivants du Code civil). Ces garanties permettent au client d'obtenir la
				réparation, le remplacement ou le remboursement du produit, sans frais, en cas de défaut de
				conformité ou de vice caché, sans qu'aucune mention contraire ne puisse y faire obstacle.
			</p>
		</section>

		<section>
			<h2>7. Médiation</h2>
			<p>
				En cas de litige, le client peut recourir gratuitement à un médiateur de la consommation —
				voir les <a href="/mentions-legales">mentions légales</a> pour les coordonnées du médiateur désigné.
			</p>
		</section>

		<section>
			<h2>8. Droit applicable</h2>
			<p>
				Les présentes CGV sont soumises au droit français. En cas de litige, et à défaut de
				résolution amiable, les tribunaux français seront seuls compétents.
			</p>
		</section>
	</div>
</ShopPage>
