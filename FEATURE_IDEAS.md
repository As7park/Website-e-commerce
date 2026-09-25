# Idées de features e-commerce

Propositions d'améliorations pour aller au-delà des modules déjà en place
(wishlist, cross-sell, retours/SAV, moyens de paiement enregistrés, fidélité,
cartes cadeaux, variantes produit, questions produit, suivi de commande,
détection de fraude, relance des produits consultés jamais achetés).

**Chaque idée précise sur quelle brique existante elle s'appuie (Stripe, QStash,**
`StoreSettings` **pour le flag on/off, jobs post-paiement...) pour rester dans**`docs/`**.**

⭐ = coup de cœur / meilleur ratio effort-impact.

## Commerce & paiement

- **Upsell post-achat en un clic** — sur la page de remerciement, une offre complémentaire ajoutable sans ressaisir la carte (PaymentIntent off-session Stripe sur le moyen de paiement déjà utilisé). Se branche naturellement sur le module Moyens de paiement enregistrés.
- **Abonnements / réachat automatique** — pour les produits consommables,
  Stripe Subscriptions avec pause/annulation depuis `/auth/settings`.
  Revenu récurrent, forte rétention.
- **Devis B2B avec tarifs dégressifs** — paliers de prix par quantité,
  validation manuelle admin avant paiement (flux « devis » avant
  « commande »). Ouvre un segment pro sans casser le tunnel B2C existant.
- **Assurance transport / valeur déclarée** — option payante au checkout
  pour les envois de valeur (bijoux), ajoutée au calcul du colis Sendcloud
  existant (`packageEstimate.ts`) plutôt qu'un nouveau service : une ligne
  de plus dans `shippingCost`, une case à cocher avant `createCheckoutSession`.
- **Reprise / rachat bijoux d'occasion (trade-in)** — un client soumet une
  estampille photo + description depuis son compte, un admin évalue et émet
  un crédit (`GiftCard`, même génération de code que l'admin cartes
  cadeaux) utilisable en réduction sur un nouvel achat — flux calqué sur
  « Créditer le compte » des retours/SAV, pas une nouvelle mécanique
  financière à inventer.

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
- **Code promo anniversaire d'inscription** — un e-mail avec un code à
  usage unique envoyé chaque année à la date de création du compte
  (`User.createdAt`), même mécanique de génération que la relance panier
  (code jetable, expiration courte) et même patron de job périodique
  quotidien (QStash Schedule) que `cartRecovery`/`reviewReminder`.

## Produits & découverte

- **Configurateur bijou (gravure, taille de bague, métal)** ⭐ — le modèle
  `Custom` et le flux « commande sur-mesure » (`hasCustomItems`,
  `shippingOption: 'no_shipping'`) existent déjà pour des pièces uniques ;
  ce module structure la saisie (options prédéfinies par produit plutôt
  qu'un champ libre) et affiche le récapitulatif de personnalisation sur la
  fiche produit, la facture et le bordereau admin. Étend un flux déjà
  câblé de bout en bout plutôt que d'en créer un nouveau.
- **Wishlist partageable publiquement** — lien en lecture seule vers une
  liste de cadeaux, extension directe du module Wishlist existant.
- **Recherche visuelle** — upload d'une photo pour retrouver des produits
  similaires (plus exploratoire, nécessite un service d'embeddings
  externe).
- **Certificat d'authenticité / traçabilité pierre** — un PDF généré par
  produit (origine, certification, numéro de série), même génération PDF
  que les factures/bordereaux déjà en place, téléchargeable depuis
  `/auth/settings/factures/[id]` une fois la commande payée.

## Logistique & retrait

- **Click & collect avec créneaux** — sélection d'un point de retrait et
  d'un créneau horaire, en alternative à la livraison Sendcloud déjà
  intégrée.
- **Score éco / compensation carbone** — estimation d'empreinte carbone
  par commande (poids + distance transporteur) et option de compensation
  au checkout (petit don reversé à une association).

## Admin & ops

- **A/B testing de prix et promotions** — cohortes aléatoires par
  utilisateur pour mesurer l'impact conversion d'une remise ou d'un prix,
  au-dessus du module Promo existant.
- **Export FEC réglementaire complet** — `accountingExport.ts` produit déjà
  un CSV mensuel inspiré de la nomenclature FEC (colonnes proches,
  `JournalCode`/`EcritureDate`/`CompteNum`...) mais volontairement
  incomplet (une seule écriture par transaction, pas de contrepartie
  débit/crédit équilibrée) — le finaliser en véritable FEC opposable
  couvrirait un vrai besoin de conformité comptable française.
- **Vérification renforcée (KYC léger) pour les grosses commandes** ⭐ —
  extension directe de la détection de fraude déjà en place
  (`$lib/server/fraud.ts`) : au-delà d'un montant seuil, exige une pièce
  d'identité uploadée avant validation admin manuelle, plutôt qu'un simple
  score automatique. Réutilise le stockage d'images déjà en place
  (Cloudinary) et le flux d'approbation manuelle des retours/SAV comme
  patron d'interface admin.

## Support & confiance client

- **Chat support en direct** — file d'attente admin (WebSocket), en
  complément du module Contact (asynchrone) déjà en place.
- **Vérification d'âge pour produits réglementés** — blocage de commande
  selon la date de naissance déclarée, pour les catalogues concernés
  (alcool, etc.).
- **NPS post-livraison** — question de satisfaction courte envoyée après
  livraison confirmée, distincte des avis produit (`Review`), pour piloter
  la relation client dans le temps.
- **Badge « achat vérifié » sur les avis** — un avis (`Review`) n'affiche
  le badge que si son auteur a une commande payée pour ce produit
  (`OrderItem`/`Order.status IN (PAID, SHIPPED)`, même filtre que les
  modules de relance déjà en place) — aucun nouveau champ nécessaire,
  seulement une vérification au moment de l'affichage.

---

Pas encore priorisé collectivement : à trier par coup de cœur / effort une
fois qu'on choisit la prochaine à implémenter.
