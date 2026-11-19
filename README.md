# fluidchart

Un Lucidchart minimaliste pour réviser. On y crée des cartes, on y pose des post-it de couleur avec du texte mis en forme, et on les relie par des flèches. L'app fonctionne d'abord hors ligne, se synchronise entre appareils via son propre serveur et se protège par un code à 4 chiffres.

## Ce que fait l'app

- **Liste des cartes :** compacte et pilotable au clavier (↑↓, Entrée, F2, Suppr, `/` pour chercher, N pour créer). La recherche ignore les accents, et une suppression peut être annulée.
- **Canvas infini :**
  - outils Sélection (V), Post-it (N) et Flèche (A), avec une infobulle pour chacun ;
  - des « + » sur les bords d'un post-it pour créer et relier le suivant ;
  - une palette de couleurs au-dessus du post-it sélectionné ;
  - des flèches courbes qui suivent les post-it.
- **Texte des post-it :** éditeur riche (TipTap). Le texte est enregistré au fil de la frappe, avec une copie de secours locale en cas de fermeture brutale.
- **Hors ligne :** l'app est installable et garde ses données dans le navigateur (IndexedDB). La synchro avec le serveur se fait en arrière-plan. Pour chaque élément, la dernière modification gagne.
- **Accès :** un écran de code (pavé numérique) impose un délai entre deux essais, le même côté app et côté serveur. Un plafond global limite le nombre d'essais.

## Organisation

| Dossier | Contenu |
| --- | --- |
| `web/` | L'app : React, Vite, React Flow, TipTap, Dexie (IndexedDB) et une PWA. |
| `server/` | L'API : Hono et le SQLite intégré à Node 22. Elle gère le code d'accès, la synchronisation et sert l'app. |
| `shared/` | Le modèle de données et les règles communes aux deux. |

## Développer

Il faut Node 22.13 ou plus récent.

```bash
npm install                                        # installe aussi le contrôle anti-secrets des commits
APP_PIN=2468 COOKIE_SECURE=0 npm -w server run dev # terminal 1 : l'API (2468 = code de développement)
npm -w web run dev                                 # terminal 2 : l'app sur http://localhost:5173
```

`2468` sert uniquement au développement et aux tests. N'utilisez jamais ce code en production.

## Tester

```bash
npm test               # tests unitaires (shared, server, web)
npm run typecheck
npm -w web run e2e     # Chromium et WebKit, contre le vrai serveur (base jetable)
```

## Mettre en production

Le dépôt fournit une image Docker (`Dockerfile`, `docker-compose.yml`), à placer derrière un reverse proxy HTTPS (exemple Caddy dans `deploy/`). La configuration passe par des variables d'environnement : partez de `.env.example`.

## Secrets

- Aucun secret n'est versionné. Le code d'accès vit uniquement dans le `.env` du serveur, ignoré par git.
- Un hook de pre-commit (`.githooks/pre-commit`, activé par `npm install`) refuse tout commit qui contient un fichier `.env`, une clé privée ou un jeton.
