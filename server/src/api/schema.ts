import * as z from 'zod'
import { fr } from 'zod/locales'
import { DEFAULT_NOTE_WIDTH, NOTE_COLOR_ORDER, UNTITLED_BOARD, type NoteColor } from '@chart/shared'

// Error messages go back to whoever called the API (often an AI): in French, like the app.
z.config(fr())

const NOTE_COLORS = NOTE_COLOR_ORDER as [NoteColor, ...NoteColor[]]
const COORD = 100_000

const coordinate = (axis: string) =>
  z
    .number()
    .min(-COORD)
    .max(COORD)
    .optional()
    .meta({
      description: `Position ${axis} du coin haut-gauche du post-it, en px. À donner pour tous les post-it, ou pour aucun.`,
    })

export const NoteInputSchema = z.object({
  id: z.string().min(1).max(100).meta({
    description:
      'Identifiant choisi par vous, unique dans la carte. Les flèches désignent les post-it par cet identifiant.',
  }),
  html: z.string().max(20_000).meta({
    description:
      'Texte du post-it : HTML du sous-ensemble documenté, ou texte brut (une ligne = un paragraphe). Le serveur nettoie le reste.',
  }),
  color: z.enum(NOTE_COLORS).default('yellow').meta({ description: 'Couleur du post-it.' }),
  x: coordinate('horizontale (vers la droite)'),
  y: coordinate('verticale (vers le bas)'),
  width: z
    .number()
    .min(120)
    .max(600)
    .default(DEFAULT_NOTE_WIDTH)
    .meta({ description: 'Largeur en px ; la hauteur suit le texte.' }),
})

export const ArrowInputSchema = z.object({
  from: z.string().meta({ description: 'Identifiant du post-it de départ.' }),
  to: z.string().meta({ description: "Identifiant du post-it d'arrivée." }),
})

export const BoardInputSchema = z
  .object({
    name: z
      .string()
      .max(200)
      .meta({ description: `Nom de la carte (vide : « ${UNTITLED_BOARD} »).` }),
    notes: z.array(NoteInputSchema).max(1000).meta({ description: 'Les post-it de la carte.' }),
    arrows: z.array(ArrowInputSchema).max(2000).default([]).meta({ description: 'Les flèches, de post-it à post-it.' }),
  })
  .superRefine((board, ctx) => {
    const ids = new Set<string>()
    board.notes.forEach((note, i) => {
      if (ids.has(note.id))
        ctx.addIssue({
          code: 'custom',
          path: ['notes', i, 'id'],
          message: 'Identifiant déjà utilisé par un autre post-it.',
        })
      ids.add(note.id)
    })
    board.arrows.forEach((arrow, i) => {
      for (const end of ['from', 'to'] as const)
        if (!ids.has(arrow[end]))
          ctx.addIssue({ code: 'custom', path: ['arrows', i, end], message: 'Aucun post-it ne porte cet identifiant.' })
      if (arrow.from === arrow.to)
        ctx.addIssue({
          code: 'custom',
          path: ['arrows', i],
          message: 'Une flèche doit relier deux post-it différents.',
        })
    })
    const placed = (n: { x?: number; y?: number }) => n.x !== undefined && n.y !== undefined
    // Any coordinate given means positions were meant: then every note needs both.
    if (board.notes.some((n) => n.x !== undefined || n.y !== undefined)) {
      const i = board.notes.findIndex((n) => !placed(n))
      if (i >= 0)
        ctx.addIssue({
          code: 'custom',
          path: ['notes', i],
          message: 'Donnez x et y pour tous les post-it, ou pour aucun.',
        })
    }
  })

export type BoardInput = z.output<typeof BoardInputSchema>

export const BoardSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  updatedAt: z.number().meta({ description: 'Dernière modification (ms depuis 1970).' }),
  noteCount: z.number(),
})

export const BoardDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  updatedAt: z.number().meta({ description: 'Dernière modification (ms depuis 1970).' }),
  url: z.string().meta({ description: "Lien pour ouvrir la carte dans l'app." }),
  notes: z.array(
    z.object({
      id: z.string(),
      html: z.string(),
      color: z.enum(NOTE_COLORS),
      x: z.number(),
      y: z.number(),
      width: z.number(),
    }),
  ),
  arrows: z.array(ArrowInputSchema),
})
