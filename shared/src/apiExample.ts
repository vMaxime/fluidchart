import type { NoteColor } from './model'

export type ApiExampleBoard = {
  name: string
  notes: { id: string; html: string; color?: NoteColor; width?: number }[]
  arrows: { from: string; to: string }[]
}

/**
 * The documented example of the board API (POST /api/v1/boards): a revision card using every
 * formatting the API accepts, without positions (the server lays it out). Its html is in the exact
 * form the note editor produces — tests on both sides keep it that way.
 */
export const API_EXAMPLE_BOARD: ApiExampleBoard = {
  name: 'Régulation de la glycémie',
  notes: [
    {
      id: 'glycemie',
      color: 'yellow',
      width: 240,
      html: '<p style="text-align: center;"><span style="font-size: 22px;"><strong>Glycémie</strong></span></p><p style="text-align: center;">Normale à jeun : <mark data-color="#fde047" style="background-color: rgb(253, 224, 71); color: inherit;">0,7 – 1,1 g/L</mark></p>',
    },
    {
      id: 'hyper',
      color: 'pink',
      html: '<p><strong>Hyperglycémie</strong></p><p>Après un repas, la glycémie <u>monte</u>.</p>',
    },
    {
      id: 'insuline',
      color: 'blue',
      html: '<p><span style="color: rgb(220, 38, 38);"><strong>Insuline</strong></span></p><p>Sécrétée par les cellules <em>β</em> des îlots de Langerhans.</p>',
    },
    {
      id: 'effets',
      color: 'blue',
      html: "<p><strong>Effets de l'insuline</strong></p><ul><li><p>Captage du glucose (muscle, tissu adipeux)</p></li><li><p>Glycogénogenèse hépatique</p></li><li><p>Inhibe la lipolyse</p></li></ul>",
    },
    {
      id: 'hypo',
      color: 'green',
      html: "<p><strong>Hypoglycémie</strong></p><p>À jeun ou à l'effort.</p>",
    },
    {
      id: 'glucagon',
      color: 'orange',
      html: '<p><span style="color: rgb(37, 99, 235);"><strong>Glucagon</strong></span></p><p>Cellules <em>α</em> : glycogénolyse, néoglucogenèse.</p><p><span style="font-size: 12px;">Hormone hyperglycémiante.</span></p>',
    },
  ],
  arrows: [
    { from: 'glycemie', to: 'hyper' },
    { from: 'hyper', to: 'insuline' },
    { from: 'insuline', to: 'effets' },
    { from: 'glycemie', to: 'hypo' },
    { from: 'hypo', to: 'glucagon' },
  ],
}
