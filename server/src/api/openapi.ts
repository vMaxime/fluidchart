import * as z from 'zod'
import { API_EXAMPLE_BOARD } from '@chart/shared'
import { BoardDetailSchema, BoardInputSchema, BoardSummarySchema } from './schema'

/** JSON Schema of a zod schema, as an OpenAPI 3.1 component (no `$schema` key). */
function component(schema: z.ZodType, io: 'input' | 'output' = 'output') {
  const { $schema: _, ...json } = z.toJSONSchema(schema, { io })
  return json
}

const DESCRIPTION = `API de fluidchart, un outil de révision fait de cartes : des post-it de couleur, au texte mis en forme, reliés par des flèches.

Authentification : en-tête \`Authorization: Bearer <jeton>\` sur toutes les routes sauf ce document.

## Recréer une carte Lucidchart à partir de son PDF

1. **Un post-it par forme** (rectangle, note, bulle…) portant du texte. Recopiez le texte fidèlement, mise en forme comprise (voir plus bas).
2. Donnez à chaque post-it un \`id\` court de votre choix (ex. \`insuline\`), unique dans la carte.
3. **Une flèche par connecteur** entre deux formes : \`from\` = id du post-it de départ, \`to\` = id du post-it d'arrivée. Ignorez un connecteur qui n'a pas de forme à chaque bout.
4. **Couleur du post-it** : la plus proche parmi \`yellow\` (jaune), \`pink\` (rose), \`blue\` (bleu), \`green\` (vert), \`orange\`, \`purple\` (violet). Par défaut : \`yellow\`.
5. **Positions** : pour garder la disposition du PDF, donnez \`x\`, \`y\` (coin haut-gauche, en px, x vers la droite, y vers le bas) et \`width\` (120 à 600 px, 200 par défaut) pour **tous** les post-it. Sinon n'en donnez **aucune** : le serveur dispose la carte de haut en bas en suivant les flèches. La hauteur d'un post-it suit toujours son texte.
6. Envoyez la carte complète en un seul appel : \`POST /api/v1/boards\`. La réponse donne la carte enregistrée et son lien (\`url\`). En cas de 400, lisez \`issues\` (chemin du problème + message), corrigez et renvoyez.

## Texte des post-it (sous-ensemble HTML)

- \`<p>\` : un paragraphe par ligne de texte ; \`<br>\` : retour à la ligne dans un paragraphe.
- \`<strong>\` gras, \`<em>\` italique, \`<u>\` souligné.
- \`<mark style="background-color: #fde047">\` surlignage. Couleurs conseillées : jaune \`#fde047\`, rouge \`#fca5a5\`, bleu \`#93c5fd\`, vert \`#86efac\`, violet \`#d8b4fe\`.
- \`<span style="color: #dc2626">\` couleur du texte, en \`#rgb\`, \`#rrggbb\` ou \`rgb(r, g, b)\`. Couleurs de l'éditeur : noir \`#1c1917\`, rouge \`#dc2626\`, bleu \`#2563eb\`, vert \`#16a34a\`, violet \`#9333ea\`, orange \`#ea580c\`, gris \`#78716c\`.
- \`<span style="font-size: 18px">\` taille : \`12px\` petit, \`18px\` grand, \`22px\` titre ; sans style, taille normale (14 px). Toute autre taille (px ou pt) est ramenée à la plus proche.
- \`<p style="text-align: center">\` alignement : \`center\` ou \`right\` (à gauche par défaut).
- \`<ul>\` / \`<ol>\` avec des \`<li><p>…</p></li>\` : listes.

Tout le reste (autres balises, attributs, styles) est retiré, le texte restant. Un texte sans aucune balise devient un paragraphe par ligne.

## Limites

Nom : 200 caractères. 1000 post-it et 2000 flèches par carte. Texte d'un post-it : 20 000 caractères. Coordonnées : ±100 000 px.

## Sauvegarder ou recopier une carte

\`GET /api/v1/boards/{id}\` renvoie une carte dans la forme exacte que \`POST /api/v1/boards\` accepte.`

const json = (schema: unknown, example?: unknown) => ({
  'application/json': example === undefined ? { schema } : { schema, example },
})
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const error = (description: string) => ({ description, content: json(ref('Error')) })
const locked = {
  401: error('Jeton manquant ou faux.'),
  503: error("API désactivée : aucun jeton n'est configuré sur le serveur."),
}

/** The OpenAPI 3.1 document given to an AI (or a person) to use the board API. */
export function openApiDocument(origin: string): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: { title: 'fluidchart API', version: '1', description: DESCRIPTION },
    servers: [{ url: origin }],
    security: [{ bearer: [] }],
    paths: {
      '/api/v1/boards': {
        get: {
          summary: 'Lister les cartes',
          description: 'Les cartes, de la plus récemment modifiée à la plus ancienne.',
          responses: {
            200: { description: 'Les cartes.', content: json({ type: 'array', items: ref('BoardSummary') }) },
            ...locked,
          },
        },
        post: {
          summary: 'Créer une carte complète',
          description:
            'Crée la carte, ses post-it et ses flèches en un seul appel. Elle arrive ensuite sur les appareils par la synchronisation.',
          requestBody: { required: true, content: json(ref('BoardInput'), API_EXAMPLE_BOARD) },
          responses: {
            201: {
              description: 'La carte enregistrée (texte nettoyé, positions calculées si absentes).',
              content: json(ref('BoardDetail')),
            },
            400: error('Carte invalide : `issues` donne le chemin et la raison de chaque problème.'),
            ...locked,
          },
        },
      },
      '/api/v1/boards/{id}': {
        get: {
          summary: 'Lire une carte',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: {
              description: 'La carte, dans la forme que POST /api/v1/boards accepte.',
              content: json(ref('BoardDetail')),
            },
            404: error('Aucune carte avec cet identifiant.'),
            ...locked,
          },
        },
      },
      '/api/v1/openapi.json': {
        get: {
          summary: 'Ce document',
          security: [],
          responses: { 200: { description: 'La description OpenAPI de cette API.' } },
        },
      },
    },
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
      schemas: {
        BoardInput: component(BoardInputSchema, 'input'),
        BoardDetail: component(BoardDetailSchema),
        BoardSummary: component(BoardSummarySchema),
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: { type: 'string' },
            issues: {
              type: 'array',
              items: {
                type: 'object',
                required: ['path', 'message'],
                properties: { path: { type: 'string', examples: ['arrows.3.to'] }, message: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  }
}
