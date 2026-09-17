# Idées de features e-commerce

Propositions d'améliorations pour aller au-delà des modules déjà en place
(wishlist, cross-sell, retours/SAV, moyens de paiement enregistrés, fidélité,
cartes cadeaux, variantes produit, questions produit, suivi de commande).

**Chaque idée précise sur quelle brique existante elle s'appuie (Stripe, QStash,**
`StoreSettings` **pour le flag on/off, jobs post-paiement...) pour rester dans**`docs/`**.**

⭐ = coup de cœur / meilleur ratio effort-impact.

## Commerce & paiement

- **Upsell post-achat en un clic** — sur la page de remerciement, uneù offre complémentaire ajoutable sans ressaisir la carte (PaymentIntent off-session Stripe sur le moyen de paiement déjà utilisé). Se branche naturellement sur le module Moyens de paiement enregistrés.
- **Abonnements / réachat automatique** — pour les produits consommables,
  Stripe Subscriptions avec pause/annulation depuis `/auth/settings`.
  Revenu récurrent, forte rétention.
- **Devis B2B avec tarifs dégressifs** — paliers de prix par quantité,
  validation manuelle admin avant paiement (flux « devis » avant
  « commande »). Ouvre un segment pro sans casser le tunnel B2C existant.

## Fidélité & croissance

- **Paliers de fidélité multiples (bronze / argent / or)** au lieu d'un
  seuil unique par code — chaque palier débloque un avantage cumulatif
  (réduction permanente, livraison offerte). Évolution naturelle de
  `LoyaltyAward` / `loyaltyThreshold`.
- **Cagnotte cadeau collaborative** — plusieurs proches contribuent à une
  cagnotte pour un produit précis (anniversaire, mariage), lien de
  partage public, jauge de progression, conversion automatique en gift
  card une fois l'objectif atteint.
- **Programme VIP payant** (façon Prime) — abonnement Stripe donnant accès
  à la livraison offerte illimitée et à des remises exclusives.
- **Programme d'affiliation** — dashboard de commissions pour des
  partenaires externes, lien traqué, versement automatique (Stripe
  Connect). Plus lourd que le parrainage mais ouvre un canal d'acquisition
  externe.

## Produits & découverte

- **Historique de navigation « vu récemment »** — liste des derniersù produits consultés, visible en vitrine et relancée par e-mail si abandon sans achat.
- **Wishlist partageable publiquement** — lien en lecture seule vers une
  liste de cadeaux, extension directe du module Wishlist existant.
- **Recherche visuelle** — upload d'une photo pour retrouver des produits
  similaires (plus exploratoire, nécessite un service d'embeddings
  externe).

## Logistique & retrait

- **Click & collect avec créneaux** — sélection d'un point de retrait et
  d'un créneau horaire, en alternative à la livraison Sendcloud déjà
  intégrée.
- **Score éco / compensation carbone** — estimation d'empreinte carbone
  par commande (poids + distance transporteur) et option de compensation
  au checkout (petit don reversé à une association).

## Admin & ops

- **Détection de fraude simple** — score de risque par commande (vélocité
  de commandes par compte, écart adresse facturation/livraison, e-mail
  jetable), affiché dans `/admin/sales`, avec blocage optionnel avant
  capture Stripe.
- **A/B testing de prix et promotions** — cohortes aléatoires par
  utilisateur pour mesurer l'impact conversion d'une remise ou d'un prix,
  au-dessus du module Promo existant.

## Support & confiance client

- **Chat support en direct** — file d'attente admin (WebSocket), en
  complément du module Contact (asynchrone) déjà en place.
- **Vérification d'âge pour produits réglementés** — blocage de commande
  selon la date de naissance déclarée, pour les catalogues concernés
  (alcool, etc.).
- **NPS post-livraison** — question de satisfaction courte envoyée après
  livraison confirmée, distincte des avis produit (`Review`), pour piloter
  la relation client dans le temps.

---

Pas encore priorisé collectivement : à trier par coup de cœur / effort une
fois qu'on choisit la prochaine à implémenter.

Voici quelques idées vraiment ciblées sur les briques déjà en place (donc du même calibre effort/impact que l'export comptable, le parrainage ou "souvent achetés ensemble") — pas des redites de ce qui est déjà dans `FEATURE_IDEAS.md` :

**⭐ Avoir / note de crédit PDF sur les retours** \n Quand un retour est remboursé (Stripe) ou crédité (gift card), il n'existe aujourd'hui aucun document formel équivalent à la facture — juste un changement de statut. Génère un PDF "avoir" (même moteur `jspdf`/`jspdf-autotable` que `invoice/pdf.ts`), envoyé par email au même moment que le remboursement/crédit dans `/admin/returns`. Complète naturellement le module Retours/SAV _et_ l'export comptable qu'on vient de finir (un avoir sans total qui matche l'export serait un vrai trou côté compta).

**⭐ Alerte "de retour en stock"** \n Sur une fiche produit en rupture (`stock = 0`), un client laisse son email ("me prévenir"). Job périodique (même pattern que `cleanup.ts`/`cartRecovery.ts`) scanne les produits repassés en stock et envoie l'email. Nouveau modèle simple (`StockAlertSubscription`), flag `StoreSettings`, réutilise `sendMail`. Peu de code, forte valeur perçue côté client.

**⭐ Notification chargeback Stripe (**`charge.dispute.created`) \n Vous avez déjà un webhook entrant Sendcloud avec vérif de signature — même modèle pour un second event Stripe (`charge.dispute.created`/`.closed`) : flag la transaction, alerte admin (email ou `reportIfRepeated`/Sentry existant), visible dans `/admin/sales`. C'est un vrai angle mort opérationnel qu'un audit sécurité/fraude pointerait, et ça ne demande aucune nouvelle UI lourde.

**Relance avis produit post-livraison** \n `Review` existe déjà mais rien ne sollicite activement le client. X jours après passage en `SHIPPED` (ou webhook Sendcloud `delivered` que vous avez déjà), un job envoie un email "notez votre achat" avec lien direct vers le formulaire d'avis — jamais relancé deux fois (record d'idempotence comme l'export comptable ou le cart-recovery).

**Alerte baisse de prix / vente flash sur la wishlist** \n Vous avez Wishlist + Vente flash déjà en place mais ils ne se parlent pas. Job qui scanne les wishlists et notifie par email quand un produit y figurant passe en vente flash ou baisse de prix. Fait converger deux modules existants sans nouveau concept.
