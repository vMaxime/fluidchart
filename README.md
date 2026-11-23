# fluidchart

Un Lucidchart minimaliste pour réviser. On y crée des cartes, on y pose des post-it de couleur avec du texte mis en forme, et on les relie par des flèches. L'app fonctionne d'abord hors ligne, se synchronise entre appareils via son propre serveur et se protège par un code à 4 chiffres.

## Ce que fait l'app

- **Liste des cartes :** compacte et pilotable au clavier (↑↓, Entrée, F2, Suppr, `/` pour chercher, N pour créer). La recherche ignore les accents, et une suppression peut être annulée.
- **Canvas infini :**
  - outils Sélection (V), Post-it (N) et Flèche (A), avec une infobulle pour chacun ;
  - des « + » sur les bords d'un post-it pour créer et relier le suivant ;
  - une palette de couleurs au-dessus du post-it sélectionné ;
  - ⌘C sur un post-it sélectionné copie tout son texte ; coller du texte quand rien n'est focalisé crée un post-it au centre de la vue ;
  - ⌘D (ou le bouton « Dupliquer ») copie les post-it sélectionnés, avec les flèches qui les relient ;
  - une poignée en bas à droite du post-it sélectionné pour le redimensionner (la hauteur choisie est un minimum : le texte n'est jamais coupé) ;
  - des flèches courbes qui suivent les post-it, avec une palette de couleurs sur la flèche sélectionnée ou juste tracée.
- **Texte des post-it :** éditeur riche (TipTap). Pendant l'écriture, une barre de mise en forme remplace la palette au-dessus du post-it ; elle porte aussi la couleur du post-it. Le texte est enregistré au fil de la frappe, avec une copie de secours locale en cas de fermeture brutale.
- **Export PDF :** « Exporter en PDF » propose un format révision (une page à la taille de la carte, pour l'écran) et un format imprimante (A4, découpé en pages numérotées si le texte deviendrait trop petit). Le PDF passe par la fenêtre d'impression du navigateur, rendu comme à l'écran, hors ligne aussi.
- **Hors ligne :** l'app est installable et garde ses données dans le navigateur (IndexedDB). La synchro avec le serveur se fait en arrière-plan. Pour chaque élément, la dernière modification gagne.
- **Accès :** un écran de code (pavé numérique) impose un délai entre deux essais, le même côté app et côté serveur. Un plafond global limite le nombre d'essais.
- **API pour une IA :** une route crée une carte complète (post-it, couleurs, texte mis en forme, flèches) en un appel. Par exemple, une IA à qui l'on donne le PDF d'une carte Lucidchart peut la recréer. La carte arrive ensuite sur les appareils par la synchro.

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

Le dépôt fournit une image Docker (`Dockerfile`, `docker-compose.yml`), à placer derrière un reverse proxy HTTPS. Deux exemples sont dans `deploy/` : Caddy, et nginx pour un nginx déjà en place. La configuration passe par des variables d'environnement : partez de `.env.example`.

Derrière un reverse proxy, mettez `TRUST_PROXY=1` et ne publiez pas le port de l'app. Le proxy doit **remplacer** l'en-tête `X-Forwarded-For` et non le compléter : le délai entre deux essais de code se calcule sur cette IP.

## API pour une IA

L'API est désactivée tant que le serveur n'a pas de jeton. Pour l'activer, mettez dans `.env` une variable `API_TOKEN` d'au moins 32 caractères (par exemple la sortie de `openssl rand -hex 32`). Ce jeton n'a rien à voir avec le code d'accès.

| Route | Rôle |
| --- | --- |
| `GET /api/v1/openapi.json` | La documentation OpenAPI, publique, avec un exemple complet. C'est elle qu'on donne à l'IA. |
| `POST /api/v1/boards` | Crée une carte complète. Sans positions, le serveur dispose les post-it selon les flèches. |
| `GET /api/v1/boards` | Liste les cartes. |
| `GET /api/v1/boards/{id}` | Lit une carte, dans la forme que `POST` accepte. |

Toutes les routes, sauf la documentation, demandent l'en-tête `Authorization: Bearer <jeton>` :

```bash
curl -X POST https://votre-domaine/api/v1/boards \
  -H "Authorization: Bearer $API_TOKEN" -H 'Content-Type: application/json' \
  --data @carte.json
```

Le serveur nettoie le texte reçu : il ne garde que la mise en forme de l'éditeur (gras, italique, souligné, surlignage, couleur, taille, alignement, listes).

## Secrets

- Aucun secret n'est versionné. Le code d'accès vit uniquement dans le `.env` du serveur, ignoré par git.
- Un hook de pre-commit (`.githooks/pre-commit`, activé par `npm install`) refuse tout commit qui contient un fichier `.env`, une clé privée ou un jeton.
