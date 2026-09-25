# Conformité réglementaire e-commerce — pistes à traiter

Document vivant, dans le même esprit que `AUDIT_TECHNIQUE.md` et
`FEATURE_IDEAS.md` : bilan des obligations légales applicables à une
boutique en ligne France/UE (vente B2C, bijouterie/joaillerie), comparé à
l'état réel constaté dans ce dépôt. **Ceci n'est pas un avis juridique** —
à faire valider par un avocat/expert-comptable avant toute mise en
production réelle. Objectif : une liste de vérification de départ, pas un
audit juridique complet.

**Méthode** : chaque ligne a été vérifiée en lisant le code (routes,
schéma Prisma, `checkout.ts`) — pas une liste générique copiée d'ailleurs.

## Résumé exécutif

Les 3 points ci-dessous sont **traités côté code** (voir détail dans les
sections correspondantes plus bas, marquées ✅ mise à jour) :

1. **Pages légales créées** — `/mentions-legales`, `/cgv`,
   `/confidentialite` + pied de page + bannière cookies + case CGV
   obligatoire au checkout. Les champs d'identité de l'entreprise (SIRET,
   adresse, capital social...) restent `[À COMPLÉTER]` — je ne peux pas les
   inventer, voir la section 3.
2. **Taux de TVA configurable** — remplace l'ancienne constante figée à
   5,5 % : `StoreSettings.vatRate`, modifiable depuis `/admin/settings`.
   Le taux par défaut reste 5,5 % (comportement inchangé tant qu'un admin
   ne le modifie pas explicitement) — **le taux réellement applicable
   (20 % attendu pour la bijouterie) reste à confirmer par un
   expert-comptable et à saisir en admin**, ce n'était pas à moi de
   trancher.
3. **Rétractation légale distinguée du SAV** — `ReturnRequest.kind`
   (`WITHDRAWAL`/`WARRANTY`), formulaire client avec le bon texte légal,
   masqué sur les commandes sur-mesure (exclusion légale), remboursement
   déjà intégral (frais de port inclus) dans les deux cas.

⚠️ Migration Prisma générée (`prisma/migrations/20260924140000_add_vat_rate_and_return_kind`)
mais **pas encore appliquée à la base** — nécessite une confirmation
explicite (voir échange de session, le classificateur automatique refuse
`prisma migrate deploy` par défaut).

Pour situer par rapport à `AUDIT_TECHNIQUE.md` : la purge RGPD automatisée
déjà en place (`$lib/server/jobs/cleanup.ts` — sessions expirées, tokens,
paniers abandonnés) couvre le principe de minimisation des données
(RGPD art. 5.1.e), **pas** le droit à l'effacement sur demande d'une
personne (art. 17, section 1 ci-dessous) — deux obligations différentes,
la seconde reste à construire.

---

## 1. Protection des données personnelles (RGPD + CNIL)

| Obligation                       | Base légale                    | État constaté            | Piste                                                                                                        |
| -------------------------------- | ------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Politique de confidentialité     | RGPD art. 13-14                | ✅ `/confidentialite`    | Distincte des CGV                                                                                            |
| Bannière cookies/traceurs        | Directive ePrivacy, reco. CNIL | ✅ `CookieNotice.svelte` | Information (aucun traceur non essentiel actif) plutôt qu'un consentement, cohérent avec l'état réel du site |
| Consentement marketing opt-in    | RGPD art. 6                    | ✅ En place              | `User.marketingEmailsOptIn`, défaut `false`, déjà bien distingué des e-mails transactionnels                 |
| Sécurité technique des données   | RGPD art. 32                   | ✅ En place              | Argon2id, TOTP/recovery chiffrés AES, 2FA — bon niveau technique                                             |
| Minimisation / purge automatique | RGPD art. 5.1.e                | ✅ En place              | `cleanup.ts` — sessions, tokens, paniers `PENDING` abandonnés                                                |
| Droit d'accès et rectification   | RGPD art. 15-16                | 🟡 Partiel               | Rectification via `/auth/settings` déjà possible ; pas de vue « toutes mes données »                         |
| Droit à la portabilité           | RGPD art. 20                   | ❌ Manquant              | Export JSON/CSV des données du compte                                                                        |
| Droit à l'effacement sur demande | RGPD art. 17                   | 🟡 Partiel               | Suppression existe côté admin (`/admin/users?/deleteUser`) ; pas de canal self-service ni de délai documenté |
| Registre des traitements         | RGPD art. 30                   | ❌ Hors code             | Document interne, pas une fonctionnalité                                                                     |

## 2. Droit de la consommation & vente à distance

| Obligation                                   | Base légale                                    | État constaté             | Piste                                                                                                                                     |
| -------------------------------------------- | ---------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| CGV                                          | Code com. L441-1, Code conso. L111-1           | ✅ `/cgv` + case à cocher | Case obligatoire dans l'action `checkout`, revalidée côté serveur                                                                         |
| Droit de rétractation (14 j)                 | Code conso. L221-18 à L221-28                  | ✅ `ReturnRequest.kind`   | `WITHDRAWAL` vs `WARRANTY`, sans motif requis pour une rétractation, remboursement déjà intégral (frais de port inclus) dans les deux cas |
| Exclusion pour biens personnalisés           | Code conso. L221-28, 3°                        | ✅ Appliqué               | Option masquée côté client ET revérifiée côté serveur si `Transaction.shippingOption === 'no_shipping'`                                   |
| Garantie légale de conformité + vices cachés | Code conso. L217-3 s., Code civil art. 1641 s. | ❌ Manquant               | Mention obligatoire même si la garantie existe par la loi sans mention                                                                    |
| Médiateur de la consommation                 | Code conso. L616-1 s.                          | ❌ Manquant               | Désigner un médiateur agréé, afficher ses coordonnées                                                                                     |
| Délai de livraison engagé                    | Code conso. L216-1 s.                          | 🟡 Partiel                | Suivi Sendcloud après expédition ; aucune date engagée avant commande                                                                     |

## 3. Mentions légales & identification (LCEN)

| Obligation                | Base légale       | État constaté                | Piste                                                                                                                                                                                   |
| ------------------------- | ----------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page « Mentions légales » | LCEN art. 6-III-1 | 🟡 `/mentions-legales` créée | Structure + hébergeur (Vercel, adresse réelle) en place ; raison sociale/SIRET/TVA/directeur de publication encore `[À COMPLÉTER]` — je ne peux pas inventer l'identité de l'entreprise |
| CGU                       | Bonne pratique    | ❌ Manquant                  | Utile : le site accepte du contenu utilisateur (avis, questions produit, commentaires blog)                                                                                             |

## 4. Facturation, prix & fiscalité

| Obligation                    | Base légale                             | État constaté   | Piste                                                                                                                                                 |
| ----------------------------- | --------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Taux de TVA correct           | CGI art. 278 s.                         | 🟡 Configurable | `StoreSettings.vatRate`, modifiable depuis `/admin/settings` — reste à saisir le bon taux (20 % attendu), décision volontairement laissée à un humain |
| Mentions obligatoires facture | Code com. L441-9, CGI art. 242 nonies A | 🟡 Partiel      | `invoiceNumber`/`subtotalHt`/`taxRate`/`taxAmount` déjà en base ; vérifier que le PDF affiche SIRET + n° TVA vendeur                                  |
| Affichage des prix TTC        | Arrêté du 3 déc. 1987                   | 🟡 Partiel      | À confirmer sur la fiche produit vitrine, pas seulement au checkout                                                                                   |
| Guichet unique TVA (OSS)      | CGI art. 298 sexdecies-G                | ❌ Manquant     | Pertinent seulement au-delà de 10 000 €/an de ventes hors France vers l'UE                                                                            |

## 5. Paiement en ligne

| Obligation                   | Base légale                   | État constaté | Piste                                                                   |
| ---------------------------- | ----------------------------- | ------------- | ----------------------------------------------------------------------- |
| PCI-DSS                      | Norme sectorielle obligatoire | ✅ En place   | Stripe Checkout hébergé, aucune donnée carte ne transite par le serveur |
| Authentification forte (SCA) | DSP2                          | ✅ En place   | Gérée nativement par Stripe Checkout (3D Secure)                        |

## 6. Spécifique métaux précieux & diamants

| Obligation                         | Base légale                                 | État constaté | Piste                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Titrage/poinçon métal précieux     | CGI art. 521 s.                             | ❌ Manquant   | `Material` est un simple libellé (`{ id, name }`), aucun champ de titrage structuré — à vérifier en priorité côté fournisseur                         |
| Traçabilité/certification diamants | Processus de Kimberley, normes sectorielles | 🟡 Partiel    | Rejoint l'idée « certificat d'authenticité » de `FEATURE_IDEAS.md` — ici adossée à une vraie obligation de transparence, pas qu'un argument marketing |

## 7. Accessibilité numérique

| Obligation | Base légale                       | État constaté | Piste                                                                                      |
| ---------- | --------------------------------- | ------------- | ------------------------------------------------------------------------------------------ |
| RGAA       | Loi n°2005-102, décret n°2019-768 | ⬜ Non audité | Audit dédié nécessaire (contraste, clavier, ARIA) si le seuil de CA applicable est atteint |

---

Pas encore priorisé collectivement : à faire confirmer point par point avec
un avocat/expert-comptable avant d'attaquer l'implémentation, en commençant
par le résumé exécutif ci-dessus.
