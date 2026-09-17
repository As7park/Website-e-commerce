# Récapitulatif des améliorations — semaine du 2026-09-16/17

Document de synthèse (pas un changelog technique exhaustif — le détail
complet de chaque décision reste dans l'historique de commits et les
`docs/<module>/README.md`).

## 1. Nouvelles fonctionnalités

| Fonctionnalité                                              | Résumé                                                                                                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Parrainage**                                              | Lien unique par compte, -10% sur la 1ère commande du filleul, carte cadeau de 10€ pour le parrain une fois cette commande payée. Page `/auth/settings/referral`.                                             |
| **Souvent achetés ensemble**                                | Suggestions de produits fréquemment co-achetés (historique de commandes payées), remise de 10% si combo ajouté, bannière au checkout.                                                                        |
| **Alerte fidélité** _(base déjà existante, consolidée)_     | Récompense automatique après N commandes payées.                                                                                                                                                             |
| **Alerte wishlist : baisse de prix / vente flash**          | Un compte est notifié par e-mail si un produit de sa liste de souhaits baisse de prix ou entre en vente flash, une seule fois par valeur (pas de spam en cas de sauvegarde admin identique).                 |
| **Relance avis produit post-livraison**                     | E-mail automatique ~7 jours après expédition invitant à laisser un avis, un seul envoi par commande.                                                                                                         |
| **Notification de litige Stripe (chargeback)**              | Alerte immédiate (Sentry + e-mail optionnel) à l'ouverture/fermeture d'un litige bancaire, colonne dédiée sur `/admin/sales`.                                                                                |
| **Avoir / note de crédit PDF**                              | Génération automatique d'un avoir PDF numéroté (`AV-AAAA-00001`) lors d'un remboursement ou crédit magasin sur un retour, téléchargeable côté client.                                                        |
| **Export comptable mensuel automatisé**                     | CSV des transactions du mois précédent envoyé par e-mail le 1er de chaque mois, idempotent (jamais de doublon même en cas de nouvel essai).                                                                  |
| **Webhook Sendcloud entrant**                               | Suivi de commande mis à jour automatiquement dès que Sendcloud signale un changement de statut colis.                                                                                                        |
| **Séparation adresse livraison / facturation**              | La facture PDF utilise désormais la vraie adresse de facturation (auparavant elle affichait toujours l'adresse de livraison).                                                                                |
| **Retours / SAV, moyens de paiement enregistrés, fidélité** | Trois parcours client consolidés (remboursement Stripe ou crédit magasin, carte bancaire enregistrée, programme de fidélité).                                                                                |
| **KPIs tableau de bord admin**                              | Panier moyen, taux de reconversion des paniers abandonnés, stock bas, retours en attente, questions sans réponse, nouveaux clients, etc. — 18 indicateurs, coût constant quel que soit le volume de données. |

## 2. Sécurité & fiabilité

- **Audit complet anti-injection SQL** (à la demande) : toutes les requêtes
  passent par Prisma (paramétrage automatique), zéro SQL brut avec des
  valeurs utilisateur concaténées trouvé dans l'application. Protection
  confirmée par construction.
- **Nettoyage des dépendances** : ~70 paquets morts supprimés (résidus d'un
  starter jamais utilisé), `npm audit` passé de 58 à 11 vulnérabilités
  (`nodemailer`, `jspdf` mis à jour, `tar`/`tinymce`/`vite` corrigés).
  Quelques vulnérabilités mineures restantes documentées et acceptées
  (composants dev-only ou nécessitant un test visuel avant bump majeur).
- **Rotation des secrets documentée** (`docs/secrets-rotation.md`) : clé de
  chiffrement, Stripe/Sendcloud, QStash.
- **Résilience Sendcloud** : disjoncteur (circuit breaker) + limite de
  tentatives + file d'attente d'échecs (dead-letter) pour ne plus jamais
  bloquer un paiement à cause d'une panne du transporteur.
- **Alerting** : remontée automatique (Sentry) en cas de taux d'erreurs 5xx
  élevé ou de contention anormale sur les verrous internes.
- **CI ajoutée** (`.github/workflows/ci.yml`) : build, lint, vérification de
  types, tests unitaires et audit de sécurité à chaque push.

## 3. Performance & architecture (3 audits ciblés cette semaine)

**Round 1 — jobs de fond :**

- Ajout d'un index manquant (`WishlistItem.productId`) utilisé à chaque
  changement de prix/vente flash.
- Correction d'une récompense fidélité qui pouvait être définitivement
  perdue si l'envoi de l'e-mail échouait.
- Deux jobs de relance (panier abandonné, avis produit) parallélisés au
  lieu d'un traitement un par un.

**Round 2 — chemin de requête principal (exécuté à chaque navigation) :**

- Ajout d'un index composite sur les commandes (client + statut), utilisé
  sur quasiment chaque page vue par un client connecté.
- Suppression d'une requête en double sur la page de paiement.
- Désactivation de la vérification "panier en cours" sur les pages
  d'administration et les routes techniques (`/api/**`), qui ne
  l'utilisent jamais.

**Round 3 — administration :**

- La fiche client admin chargeait le compte et ses adresses l'un après
  l'autre ; les deux requêtes tournent maintenant en parallèle.
- La suppression d'un produit (seule ou en lot) chargeait toutes ses
  relations (catégories, matière, taxonomies) pour ne récupérer au final
  que ses images ; remplacé par une lecture allégée.
- Plusieurs pistes soulevées par un audit automatique se sont révélées
  fausses après vérification manuelle (index déjà couverts par une
  contrainte existante, boucles déjà volontairement séquentielles pour
  gérer proprement les erreurs une par une) — non modifiées.

**Points identifiés mais pas encore traités (nécessitent une décision) :**

- La vitrine publique du blog charge tous les articles publiés sans
  pagination — sans impact aujourd'hui vu le volume, mais à surveiller si
  le blog grandit beaucoup.
- Certains listings admin (produits, articles) chargent des relations qui
  ne sont peut-être pas toutes affichées à l'écran — à confirmer avant
  d'y toucher (question d'affichage, pas seulement de performance).

## 4. Corrections de bugs réels

- **Crash sur les fiches produit admin** (création et édition) : un champ
  de formulaire utilisé comme simple titre de section faisait planter la
  page. Corrigé sur les deux pages concernées.
- **Base de données de développement désynchronisée** : plusieurs
  migrations n'avaient jamais été appliquées en local, provoquant une
  erreur "colonne introuvable" au démarrage. Base remise à niveau et
  procédure de vérification fiable documentée pour la prochaine fois.

## 5. Qualité générale du code

- Nettoyage `svelte-check` : plusieurs centaines d'erreurs de typage
  résiduelles réduites (tableaux de colonnes/actions des grilles admin
  correctement typés), sans toucher au comportement.
- Remplacement d'un fournisseur de géocodage tiers par une alternative
  gratuite et plus fiable pour l'auto-complétion d'adresse.
- Un composant d'auto-complétion d'adresse unique remplace trois
  implémentations dupliquées.
- Ajout d'un test unitaire d'exemple (les tests placeholder ont été
  retirés).

---

_Détail technique complet (fichiers, migrations, décisions précises)
disponible dans l'historique de session et les `docs/<module>/README.md`
de chaque module concerné._
