# AS7 Park — page « En cours de construction »

Branche `maintenance` : page d'attente autonome (aucune base de données,
aucune variable d'environnement), à déployer en production tant que la
boutique n'est pas ouverte.

- Page : `src/routes/+page.svelte` — images dans `static/construction/`.
- Toute autre URL redirige vers `/`.
- `vercel.json` force `vite build` : la commande de build du projet Vercel
  (`npx prisma migrate deploy && vite build`, pour la boutique) ne
  s'applique pas à cette branche — aucune migration n'est jouée.

L'historique de cette branche contient l'ancien projet complet
(dépôt `As7park/As7park-Ecommerce`, jusqu'au commit `aee965e`).

```bash
npm install
npm run dev
```
