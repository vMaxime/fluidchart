import sanitizeHtml from 'sanitize-html'
import { parseDocument } from 'htmlparser2'
import type { ChildNode, Element } from 'domhandler'

/** Text sizes the editor offers, in px; 14 is the normal size and carries no style. */
const SIZES = [12, 14, 18, 22]
const NORMAL_SIZE = 14

type Rgb = [number, number, number]

function parseStyle(style: string | undefined): Map<string, string> {
  const declarations = new Map<string, string>()
  for (const part of (style ?? '').split(';')) {
    const colon = part.indexOf(':')
    if (colon > 0) declarations.set(part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim())
  }
  return declarations
}

/** `#rgb`, `#rrggbb` or `rgb(r, g, b)`; anything else (names, url(), var() …) is refused. */
function parseColor(value: string | undefined): Rgb | null {
  if (!value) return null
  const v = value.trim().toLowerCase()
  const short = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/)
  if (short)
    return [parseInt(short[1] + short[1], 16), parseInt(short[2] + short[2], 16), parseInt(short[3] + short[3], 16)]
  const long = v.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/)
  if (long) return [parseInt(long[1], 16), parseInt(long[2], 16), parseInt(long[3], 16)]
  const rgb = v.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/)
  if (rgb) {
    const channels = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] as Rgb
    return channels.every((c) => c <= 255) ? channels : null
  }
  return null
}

const css = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`
const hex = (rgb: Rgb) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('')

/** The editor size nearest to a px or pt size; null for the normal size or an unreadable value. */
function parseSize(value: string | undefined): number | null {
  const m = value
    ?.trim()
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)(px|pt)$/)
  if (!m) return null
  const px = Number(m[1]) * (m[2] === 'pt' ? 4 / 3 : 1)
  const nearest = SIZES.reduce((best, s) => (Math.abs(s - px) < Math.abs(best - px) ? s : best))
  return nearest === NORMAL_SIZE ? null : nearest
}

// Styles are rebuilt from validated values only, in the form the editor itself produces
// (ProseMirror sets them through style.cssText, which reads back as `rgb(…)` with a final ';').
const paragraph: sanitizeHtml.Transformer = (_tag, attribs) => {
  const align = parseStyle(attribs.style).get('text-align')?.toLowerCase()
  const out: sanitizeHtml.Attributes = {}
  if (align === 'center' || align === 'right') out.style = `text-align: ${align};`
  return { tagName: 'div', attribs: out }
}

const span: sanitizeHtml.Transformer = (_tag, attribs) => {
  const style = parseStyle(attribs.style)
  const color = parseColor(style.get('color'))
  const size = parseSize(style.get('font-size'))
  const parts = [color && `color: ${css(color)};`, size && `font-size: ${size}px;`].filter(Boolean)
  const out: sanitizeHtml.Attributes = {}
  if (parts.length) out.style = parts.join(' ')
  return { tagName: 'span', attribs: out }
}

const mark: sanitizeHtml.Transformer = (_tag, attribs) => {
  const color = parseColor(parseStyle(attribs.style).get('background-color') ?? attribs['data-color'])
  const out: sanitizeHtml.Attributes = {}
  if (color) Object.assign(out, { 'data-color': hex(color), style: `background-color: ${css(color)}; color: inherit;` })
  return { tagName: 'mark', attribs: out }
}

const OPTIONS: sanitizeHtml.IOptions = {
  // Paragraphs travel as <div> until blocks() turns them back into <p>: the HTML parser would
  // otherwise apply <p> rules (a nested <p> or a list closes it, a stray </p> adds an empty one).
  allowedTags: ['div', 'br', 'strong', 'em', 'u', 'mark', 'span', 'ul', 'ol', 'li'],
  allowedAttributes: { div: ['style'], span: ['style'], mark: ['style', 'data-color'] },
  allowedSchemes: [],
  // Keep the style strings built above verbatim: sanitize-html would otherwise re-serialize them
  // (`color:rgb(…)`), away from the editor's form. Only the transforms below can write a style.
  parseStyleAttributes: false,
  transformTags: {
    b: 'strong',
    i: 'em',
    p: paragraph,
    div: paragraph,
    h1: paragraph,
    h2: paragraph,
    h3: paragraph,
    h4: paragraph,
    h5: paragraph,
    h6: paragraph,
    span,
    mark,
  },
  // A span left without any accepted style is unwrapped (its text stays).
  exclusiveFilter: (frame) => (frame.tag === 'span' && Object.keys(frame.attribs).length === 0 ? 'excludeTag' : false),
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A `<` that opens no complete tag (`PaO2<PaCO2`) is text, not the start of a tag eating the rest. */
const LONE_LT = /<(?!\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>|!--)/g

const BLOCKS = new Set(['div', 'ul', 'ol', 'li'])
const isElement = (n: ChildNode): n is Element => n.type === 'tag'
const isBlock = (n: ChildNode): n is Element => isElement(n) && BLOCKS.has(n.name)
const holdsBlock = (n: ChildNode): boolean => isElement(n) && n.children.some((c) => isBlock(c) || holdsBlock(c))
const isBlank = (n: ChildNode) => n.type === 'text' && !n.data.trim()

// Parsed with decodeEntities off: text and attributes are written back exactly as sanitize-html escaped them.
const attributes = (el: Element) =>
  Object.entries(el.attribs)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('')
const render = (n: ChildNode): string =>
  n.type === 'text'
    ? n.data
    : !isElement(n)
      ? ''
      : n.name === 'br'
        ? '<br>'
        : `<${n.name}${attributes(n)}>${n.children.map(render).join('')}</${n.name}>`

/**
 * The editor's block structure: only paragraphs and lists at the top and inside list items, inline
 * text always inside a paragraph, nothing but list items in a list. Loose inline runs become
 * paragraphs (keeping the style of a paragraph they were unwrapped from); whitespace between
 * blocks goes.
 */
function blocks(nodes: ChildNode[], style = ''): string {
  let out = ''
  let run: ChildNode[] = []
  const flush = () => {
    if (run.some((n) => !isBlank(n))) out += `<p${style}>${run.map(render).join('')}</p>`
    run = []
  }
  for (const n of nodes) {
    if (isElement(n) && (n.name === 'div' || n.name === 'li')) {
      // A paragraph (or a list item out of any list): a <p>, unless it wraps blocks — then unwrapped.
      flush()
      out += holdsBlock(n)
        ? blocks(n.children, attributes(n))
        : `<p${attributes(n)}>${n.children.map(render).join('')}</p>`
    } else if (isElement(n) && (n.name === 'ul' || n.name === 'ol')) {
      flush()
      const items = n.children.filter((c) => !isBlank(c))
      const lis = items.map(
        (c) => `<li>${blocks(isElement(c) && c.name === 'li' ? c.children : [c]) || '<p></p>'}</li>`,
      )
      out += `<${n.name}>${lis.join('')}</${n.name}>`
    } else if (holdsBlock(n)) {
      flush() // an inline element wrapped around blocks: keep the blocks, drop the wrapper
      out += blocks((n as Element).children, style)
    } else run.push(n)
  }
  flush()
  return out
}

/**
 * Reduces html written by an AI (or plain text) to what a note can hold: the documented subset, in
 * the editor's own form. Nothing executable and no style outside the list survives.
 */
export function cleanNoteHtml(input: string): string {
  const text = input.replace(/\r\n?/g, '\n')
  if (!text.trim()) return '<p></p>'
  const html = text.replace(LONE_LT, '&lt;').replace(/<(\/?)p(?=[\s>/])/gi, '<$1div')
  // Plain text (no tag at all): one paragraph per line.
  if (!/<[a-zA-Z/!]/.test(html))
    return text
      .split('\n')
      .map((line) => `<p>${escape(line)}</p>`)
      .join('')
  const clean = sanitizeHtml(html, OPTIONS)
  return blocks(parseDocument(clean, { decodeEntities: false }).children) || '<p></p>'
}
