# Chart

Un Lucidchart minimaliste pour réviser : des cartes, des post-it de couleur avec du texte mis en forme, des flèches. Hors ligne d'abord, synchronisé entre appareils via ton serveur, protégé par un code à 4 chiffres.

- `web/` : l'app (React, Vite, React Flow, TipTap). Les données vivent dans le navigateur (IndexedDB) et partent au serveur en arrière-plan.
- `server/` : l'API (Hono, SQLite intégré à Node 22). Elle gère le code d'accès, la synchronisation et sert l'app.
- `shared/` : le modèle de données et les règles partagées par les deux (dont le délai entre deux essais de code).

## Développer

Pré-requis : Node 22.13 ou plus récent.

```bash
npm install
# terminal 1 : l'API (code de test 2468, cookie sans HTTPS en local)
APP_PIN=2468 COOKIE_SECURE=0 npm -w server run dev
# terminal 2 : l'app sur http://localhost:5173 (les appels /api partent vers le terminal 1)
npm -w web run dev
```

## Tester

```bash
npm test                 # tests unitaires (shared, server, web)
npm run typecheck
npm -w web run e2e       # Chromium + WebKit contre le vrai serveur (base jetable)
```

## Déployer sur le VPS

Pré-requis sur le VPS : Docker (avec Compose) et [Caddy](https://caddyserver.com/docs/install) pour le HTTPS.

1. **Récupérer le projet** sur le VPS (par exemple avec `git clone`), puis entrer dans le dossier.
2. **Choisir le code d'accès :**
   ```bash
   cp .env.example .env
   nano .env            # APP_PIN=xxxx (4 chiffres)
   ```
   Le fichier `.env` reste sur le serveur et ne doit jamais être commité.
3. **Lancer :**
   ```bash
   docker compose up -d --build
   ```
   L'app écoute uniquement sur `127.0.0.1:8787`. Les données vont dans le volume Docker `chart-data`.
4. **Brancher le domaine :** ajouter le bloc de `deploy/Caddyfile.example` au Caddyfile du VPS (avec ton domaine), puis `sudo systemctl reload caddy`. Caddy obtient le certificat HTTPS tout seul.
   Si Caddy tourne lui-même dans Docker, remplacer `127.0.0.1:8787` par le nom du service, sur un réseau Docker commun.
5. **Sur le Mac de l'étudiant :** ouvrir le site dans Safari, entrer le code, puis **Fichier → Ajouter au Dock**. Installée ainsi, l'app garde ses données hors ligne (Safari efface celles des sites non installés après 7 jours sans visite).

**Mettre à jour :** `git pull && docker compose up -d --build`.

**Changer le code :** modifier `APP_PIN` dans `.env`, puis `docker compose up -d`. Les appareils déjà connectés le restent.

### Sécurité du code

- Le serveur impose 3 secondes entre deux essais depuis la même adresse. L'app affiche le même délai.
- Au-delà de 30 codes faux en 24 heures, toutes adresses confondues, plus aucun nouvel appareil ne peut se connecter jusqu'à ce que la fenêtre se libère d'elle-même. Les appareils déjà connectés ne sont pas touchés.
- La session dure un an par appareil (cookie `HttpOnly`, `Secure`, `SameSite=Lax`).
