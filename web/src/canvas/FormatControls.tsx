import { useEffect, useState, type ReactNode } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import type { NoteColor } from '@chart/shared'
import { usedTextColors } from '../db/repo'

const HIGHLIGHTS: [string, string][] = [
  ['#fde047', 'jaune'],
  ['#fca5a5', 'rouge'],
  ['#93c5fd', 'bleu'],
  ['#86efac', 'vert'],
  ['#d8b4fe', 'violet'],
]
const TEXT_COLORS: [string, string][] = [
  ['#1c1917', 'Noir'],
  ['#dc2626', 'Rouge'],
  ['#2563eb', 'Bleu'],
  ['#16a34a', 'Vert'],
  ['#9333ea', 'Violet'],
  ['#ea580c', 'Orange'],
  ['#78716c', 'Gris'],
]
const SIZES: [string | null, string][] = [
  ['12px', 'Petit'],
  [null, 'Normal'],
  ['18px', 'Grand'],
  ['22px', 'Titre'],
]

/** Keeps the editor focused: pressing a control must not blur the text being edited. */
const keepFocus = (e: { preventDefault(): void }) => e.preventDefault()

function Btn(props: {
  label: string
  active?: boolean
  onClick(): void
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <button
      type="button"
      className={['fmt-btn', props.active && 'is-active', props.className].filter(Boolean).join(' ')}
      aria-label={props.label}
      aria-pressed={props.active}
      title={props.label}
      style={props.style}
      onPointerDown={keepFocus}
      onMouseDown={keepFocus}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

/** The formatting controls of the floating bar (testable on their own with any editor). */
export function FormatControls({ editor, noteColor }: { editor: Editor; noteColor: NoteColor }) {
  const [open, setOpen] = useState<null | 'highlight' | 'color' | 'size'>(null)
  const [used, setUsed] = useState<string[]>([])
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      highlight: e.isActive('highlight'),
      color: (e.getAttributes('textStyle').color as string | undefined) ?? null,
      size: (e.getAttributes('textStyle').fontSize as string | undefined) ?? null,
      align: e.isActive({ textAlign: 'center' }) ? 'center' : e.isActive({ textAlign: 'right' }) ? 'right' : 'left',
    }),
  })

  useEffect(() => {
    if (open === 'color') void usedTextColors(noteColor).then(setUsed)
  }, [open, noteColor])

  const run = (fn: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => fn(editor.chain().focus()).run()
  const toggle = (panel: 'highlight' | 'color' | 'size') => setOpen((p) => (p === panel ? null : panel))
  const pickColor = (c: string | null) => {
    run((ch) => (c ? ch.setColor(c) : ch.unsetColor()))
    setOpen(null)
  }

  return (
    <div className="fmt" role="toolbar" aria-label="Mise en forme">
      <Btn label="Gras" active={s.bold} onClick={() => run((c) => c.toggleBold())}>
        <b>B</b>
      </Btn>
      <Btn label="Italique" active={s.italic} onClick={() => run((c) => c.toggleItalic())}>
        <i>I</i>
      </Btn>
      <Btn label="Souligné" active={s.underline} onClick={() => run((c) => c.toggleUnderline())}>
        <u>U</u>
      </Btn>
      <span className="fmt-sep" />
      <div className="fmt-group">
        <Btn label="Surligner" active={s.highlight || open === 'highlight'} onClick={() => toggle('highlight')}>
          <span className="fmt-hl">ab</span>
        </Btn>
        {open === 'highlight' && (
          <div className="fmt-pop" role="group" aria-label="Surlignage">
            {HIGHLIGHTS.map(([c, name]) => (
              <Btn
                key={c}
                label={`Surligner en ${name}`}
                className="fmt-swatch"
                style={{ background: c }}
                onClick={() => {
                  run((ch) => ch.toggleHighlight({ color: c }))
                  setOpen(null)
                }}
              >
                {''}
              </Btn>
            ))}
            <Btn
              label="Sans surlignage"
              className="fmt-swatch fmt-none"
              onClick={() => {
                run((ch) => ch.unsetHighlight())
                setOpen(null)
              }}
            >
              {''}
            </Btn>
          </div>
        )}
      </div>
      <div className="fmt-group">
        <Btn label="Couleur du texte" active={open === 'color'} onClick={() => toggle('color')}>
          <span className="fmt-a" style={{ borderBottomColor: s.color ?? 'currentColor' }}>
            A
          </span>
        </Btn>
        {open === 'color' && (
          <div className="fmt-pop fmt-pop-color" role="group" aria-label="Couleur du texte">
            <div className="fmt-row">
              {TEXT_COLORS.map(([c, name]) => (
                <Btn
                  key={c}
                  label={name}
                  className="fmt-swatch"
                  style={{ background: c }}
                  active={s.color === c}
                  onClick={() => pickColor(c)}
                >
                  {''}
                </Btn>
              ))}
              <Btn label="Couleur par défaut" className="fmt-swatch fmt-none" onClick={() => pickColor(null)}>
                {''}
              </Btn>
            </div>
            {used.length > 0 && (
              <>
                <p className="fmt-caption">Déjà utilisées</p>
                <div className="fmt-row">
                  {used.map((c) => (
                    <Btn
                      key={c}
                      label={`Couleur ${c}`}
                      className="fmt-swatch"
                      style={{ background: c }}
                      active={s.color === c}
                      onClick={() => pickColor(c)}
                    >
                      {''}
                    </Btn>
                  ))}
                </div>
              </>
            )}
            <label className="fmt-custom">
              <input type="color" aria-label="Autre couleur" onChange={(e) => pickColor(e.target.value)} />
              Autre couleur…
            </label>
          </div>
        )}
      </div>
      <div className="fmt-group">
        <Btn label="Taille du texte" active={open === 'size'} onClick={() => toggle('size')}>
          <span className="fmt-size">
            A<small>A</small>
          </span>
        </Btn>
        {open === 'size' && (
          <div className="fmt-pop fmt-pop-size" role="group" aria-label="Taille du texte">
            {SIZES.map(([size, name]) => (
              <Btn
                key={name}
                label={name}
                className="fmt-size-item"
                active={s.size === size}
                onClick={() => {
                  run((ch) => (size ? ch.setFontSize(size) : ch.unsetFontSize()))
                  setOpen(null)
                }}
              >
                <span style={{ fontSize: size ?? '14px' }}>{name}</span>
              </Btn>
            ))}
          </div>
        )}
      </div>
      <span className="fmt-sep" />
      {(
        [
          ['left', 'Aligner à gauche', 'M3 4h10M3 7h7M3 10h10M3 13h7'],
          ['center', 'Centrer', 'M3 4h10M5 7h6M3 10h10M5 13h6'],
          ['right', 'Aligner à droite', 'M3 4h10M6 7h7M3 10h10M6 13h7'],
        ] as const
      ).map(([align, label, d]) => (
        <Btn key={align} label={label} active={s.align === align} onClick={() => run((c) => c.setTextAlign(align))}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d={d} />
          </svg>
        </Btn>
      ))}
    </div>
  )
}
