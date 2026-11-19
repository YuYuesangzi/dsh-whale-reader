import fs from 'node:fs/promises'
import path from 'node:path'

const HEADING = /^[ \t\u3000]{0,4}((?:第[ \t]*[0-9零一二三四五六七八九十百千万两]{1,8}[ \t]*[章节回卷部篇集])|(?:Chapter|CHAPTER)[ \t]+[0-9IVXLCivxlc]{1,6}|(?:序章|序言|楔子|引子|尾声|后记|番外|终章))([^\n]{0,48})$/gm

function decodeXml(value = '') {
  return String(value)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)) } catch { return '' }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try { return String.fromCodePoint(parseInt(dec, 10)) } catch { return '' }
    })
    .replace(/&amp;/g, '&')
}

function stripHtml(html = '') {
  return decodeXml(String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n'))
    .replace(/\r\n?/g, '\n').trim()
}

function decodeText(buffer) {
  const bytes = new Uint8Array(buffer)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  }
  let oddZero = 0
  const probe = Math.min(bytes.length, 4096)
  for (let i = 1; i < probe; i += 2) if (bytes[i] === 0) oddZero += 1
  if (probe > 64 && oddZero > probe / 2 * 0.6) {
    return new TextDecoder('utf-16le').decode(bytes)
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    try { return new TextDecoder('gb18030').decode(bytes) } catch { return new TextDecoder('utf-8').decode(bytes) }
  }
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t\u3000]+$/gm, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

function bySize(text, size = 6000) {
  const paragraphs = []
  let at = 0
  for (const part of text.split(/\n{2,}/)) {
    const start = text.indexOf(part, at)
    if (start < 0) continue
    paragraphs.push({ text: part, start, end: start + part.length })
    at = start + part.length
  }
  if (!paragraphs.length) return [{ title: '正文', start: 0, end: text.length }]
  const out = []
  let buf = []
  let chars = 0
  let start = paragraphs[0].start
  let end = start
  for (const paragraph of paragraphs) {
    buf.push(paragraph.text)
    chars += paragraph.text.length
    end = paragraph.end
    if (chars >= size) {
      out.push({ title: `第 ${out.length + 1} 节`, start, end })
      buf = []
      chars = 0
      start = paragraph.end
    }
  }
  if (buf.length && end > start) out.push({ title: `第 ${out.length + 1} 节`, start, end })
  return out
}

export function splitChapters(text, { size = 6000 } = {}) {
  const body = normalizeText(text)
  if (!body) return []
  const matches = [...body.matchAll(HEADING)]
  const chapters = []
  if (matches.length > 0) {
    if (matches[0].index > 0) {
      const preface = body.slice(0, matches[0].index).trim()
      if (preface.length >= 200) chapters.push({ title: '序', start: 0, end: matches[0].index })
    }
    for (let i = 0; i < matches.length; i += 1) {
      const start = matches[i].index
      const end = i + 1 < matches.length ? matches[i + 1].index : body.length
      const title = matches[i][0].trim().slice(0, 120)
      if (end > start) chapters.push({ title, start, end })
    }
  }
  if (chapters.length <= 1) return bySize(body, size)
  return chapters
}

function chaptersFromSections(sections) {
  const chapters = []
  let cursor = 0
  for (const section of sections) {
    const text = normalizeText(section.text)
    if (!text) continue
    const start = cursor
    const end = start + text.length
    chapters.push({
      title: normalizeText(section.title).slice(0, 120) || `第 ${chapters.length + 1} 节`,
      start,
      end,
    })
    cursor = end + 2
  }
  return chapters
}

function createBook({ title, author = '', format, text, chapters }) {
  const body = normalizeText(text)
  let list = (chapters || []).filter(chapter => chapter.end > chapter.start)
  if (!list.length) list = splitChapters(body)
  return {
    title: title || '未命名',
    author: author || '',
    format,
    text: body,
    chapters: list,
  }
}

async function loadJSZip() {
  try {
    const mod = await import('jszip')
    return mod.default || mod
  } catch {
    throw new Error('缺少 jszip 依赖，请在插件目录执行 npm install')
  }
}

async function parseTxt(buffer, filename) {
  const text = decodeText(buffer)
  return createBook({ title: path.basename(filename, path.extname(filename)), format: 'txt', text, chapters: splitChapters(text) })
}

async function parseDocx(buffer, filename) {
  let mammoth
  try { mammoth = await import('mammoth') } catch { throw new Error('缺少 mammoth 依赖，请在插件目录执行 npm install') }
  const JSZip = await loadJSZip()
  const zip = await JSZip.loadAsync(buffer)
  let title = path.basename(filename, path.extname(filename))
  let author = ''
  try {
    const core = await zip.file('docProps/core.xml')?.async('string')
    const pick = (tag) => {
      const match = core && new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(core)
      return match ? decodeXml(match[1]).trim() : ''
    }
    title = pick('dc:title') || title
    author = pick('dc:creator') || ''
  } catch { /* metadata is optional */ }
  const result = await (mammoth.default || mammoth).extractRawText({ buffer: Buffer.from(buffer) })
  return createBook({ title, author, format: 'docx', text: result.value || '', chapters: [] })
}

function htmlTextAndAnchors(html) {
  const clean = String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, '')
  const anchors = new Map()
  let out = ''
  let last = 0
  for (const match of clean.matchAll(/<[^>]+>/g)) {
    out += decodeXml(clean.slice(last, match.index))
    const tag = match[0]
    if (/^<br\b/i.test(tag)) out += '\n'
    else if (/^<img\b/i.test(tag)) out += '\u200b'
    else if (/^<\/(?:p|div|h[1-6]|li|tr|blockquote|section|article)\b/i.test(tag)) out += '\n'
    const id = /\b(?:id|name)=["']([^"']+)["']/i.exec(tag)?.[1]
    if (id && !anchors.has(id)) anchors.set(decodeXml(id), out.length)
    last = match.index + tag.length
  }
  out += decodeXml(clean.slice(last))
  return { text: out, anchors }
}

function resolveHref(baseDir, href) {
  const [rawPath, rawFragment = ''] = String(href || '').split('#')
  let clean = decodeXml(rawPath.split('?')[0])
  try { clean = decodeURIComponent(clean) } catch { /* keep */ }
  if (!clean) return { path: null, fragment: decodeXml(rawFragment) }
  if (clean.startsWith('/')) clean = clean.slice(1)
  return {
    path: path.posix.normalize(path.posix.join(baseDir, clean)).replace(/^\.\//, ''),
    fragment: (() => {
      try { return decodeURIComponent(decodeXml(rawFragment)) } catch { return decodeXml(rawFragment) }
    })(),
  }
}

function parseNcx(xml) {
  const texts = []
  for (const match of String(xml).matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)) {
    const label = stripHtml(match[1]).replace(/\s+/g, ' ').trim()
    if (label) texts.push({ index: match.index, label })
  }
  const entries = []
  for (const match of String(xml).matchAll(/<content\b[^>]*\bsrc="([^"]+)"/gi)) {
    let previous = null
    for (const item of texts) {
      if (item.index < match.index) previous = item
      else break
    }
    if (previous) entries.push({ label: previous.label, href: decodeXml(match[1]) })
  }
  return entries
}

function parseNav(html) {
  const source = String(html)
  const nav = /<nav\b[^>]*(?:epub:type=["']toc["']|role=["']doc-toc["'])[^>]*>([\s\S]*?)<\/nav>/i.exec(source)?.[1]
    || /<nav\b[^>]*>([\s\S]*?)<\/nav>/i.exec(source)?.[1]
  if (!nav) return []
  const entries = []
  for (const match of nav.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = stripHtml(match[2]).replace(/\s+/g, ' ').trim()
    if (label) entries.push({ label, href: decodeXml(match[1]) })
  }
  return entries
}

function chaptersFromToc(entries, sections, body, tocBase) {
  if (!entries.length || !sections.length) return null
  const points = []
  for (const entry of entries) {
    const target = resolveHref(tocBase, entry.href)
    if (!target.path) continue
    const section = sections.find(item => item.path === target.path)
    if (!section) continue
    const inSection = target.fragment ? (section.anchors.get(target.fragment) ?? 0) : 0
    const start = Math.min(body.length, section.start + Math.max(0, Math.min(inSection, section.text.length)))
    if (!points.some(point => point.start === start)) points.push({ label: entry.label, start })
  }
  if (points.length < 2) return null
  points.sort((a, b) => a.start - b.start)
  const chapters = []
  if (points[0].start > 0) {
    const preface = body.slice(0, points[0].start).trim()
    if (preface.length >= 30) chapters.push({ title: '序', start: 0, end: points[0].start })
  }
  for (let i = 0; i < points.length; i += 1) {
    const start = points[i].start
    const end = i + 1 < points.length ? points[i + 1].start : body.length
    if (end > start) chapters.push({ title: points[i].label || `第 ${chapters.length + 1} 节`, start, end })
  }
  return chapters.length > 1 ? chapters : null
}

async function parseEpub(buffer, filename) {
  const JSZip = await loadJSZip()
  const zip = await JSZip.loadAsync(buffer)
  const container = await zip.file('META-INF/container.xml')?.async('string')
  if (!container) throw new Error('EPUB 缺少 META-INF/container.xml')
  const opfPath = /full-path="([^"]+)"/i.exec(container)?.[1]
  if (!opfPath) throw new Error('EPUB 找不到 OPF 文件')
  const opf = await zip.file(decodeXml(opfPath))?.async('string')
  if (!opf) throw new Error('EPUB 的 OPF 文件读不出来')
  const opfDir = path.posix.dirname(opfPath)
  const pickMeta = (tag) => {
    const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(opf)
    return match ? decodeXml(match[1]).replace(/\s+/g, ' ').trim() : ''
  }

  const manifest = new Map()
  for (const match of opf.matchAll(/<item\b([^>]+?)\/?>/gi)) {
    const attrs = match[1]
    const id = /\bid="([^"]+)"/i.exec(attrs)?.[1]
    const href = /\bhref="([^"]+)"/i.exec(attrs)?.[1]
    const properties = /\bproperties="([^"]+)"/i.exec(attrs)?.[1] || ''
    if (id && href) manifest.set(id, { href: decodeXml(href), properties })
  }

  const spine = []
  for (const match of opf.matchAll(/<itemref\b([^>]+?)\/?>/gi)) {
    const idref = /\bidref="([^"]+)"/i.exec(match[1])?.[1]
    const item = idref ? manifest.get(idref) : null
    if (item) spine.push(item.href)
  }
  const files = spine.length ? spine : [...manifest.values()].map(item => item.href).filter(href => /\.x?html?$/i.test(href))

  const sections = []
  for (const href of files) {
    let decoded = href
    try { decoded = decodeURIComponent(href) } catch { /* keep */ }
    const full = path.posix.normalize(path.posix.join(opfDir, decoded))
    const file = zip.file(full) || zip.file(decodeURIComponent(full))
    if (!file) continue
    const html = await file.async('string')
    const extracted = htmlTextAndAnchors(html)
    const text = normalizeText(extracted.text)
    if (!text) continue
    const leading = extracted.text.length - extracted.text.replace(/^\s+/, '').length
    const anchors = new Map()
    for (const [id, offset] of extracted.anchors) {
      anchors.set(id, Math.max(0, Math.min(text.length, offset - leading)))
    }
    const heading = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(html)?.[1]
    sections.push({
      title: heading ? stripHtml(heading) : '',
      text,
      anchors,
      path: full,
    })
  }
  if (!sections.length) throw new Error('EPUB 没有可读正文')

  let cursor = 0
  for (const section of sections) {
    section.start = cursor
    cursor += section.text.length + 2
  }
  const body = sections.map(section => section.text).join('\n\n')

  const tocId = /<spine\b[^>]*\btoc="([^"]+)"/i.exec(opf)?.[1]
  let tocEntry = tocId ? manifest.get(tocId) : null
  if (!tocEntry) tocEntry = [...manifest.values()].find(item => /(?:^|\s)nav(?:\s|$)/.test(item.properties)) || null
  if (!tocEntry) tocEntry = [...manifest.values()].find(item => /\.ncx$/i.test(item.href)) || null

  let tocBase = opfDir
  let tocPath = ''
  let entries = []
  if (tocEntry) {
    let tocHref = tocEntry.href
    try { tocHref = decodeURIComponent(tocHref) } catch { /* keep */ }
    tocPath = path.posix.normalize(path.posix.join(opfDir, tocHref))
    tocBase = path.posix.dirname(tocPath)
    const tocText = await zip.file(tocPath)?.async('string') || await zip.file(decodeURIComponent(tocPath))?.async('string')
    if (tocText) entries = /\.ncx$/i.test(tocPath) ? parseNcx(tocText) : parseNav(tocText)
  }

  if (!entries.length) {
    const nav = [...manifest.values()].find(item => /(?:^|\s)nav(?:\s|$)/.test(item.properties))
    if (nav) {
      let navHref = nav.href
      try { navHref = decodeURIComponent(navHref) } catch { /* keep */ }
      const navPath = path.posix.normalize(path.posix.join(opfDir, navHref))
      const navText = await zip.file(navPath)?.async('string') || await zip.file(decodeURIComponent(navPath))?.async('string')
      if (navText) {
        entries = parseNav(navText)
        tocBase = path.posix.dirname(navPath)
      }
    }
  }

  const tocChapters = chaptersFromToc(entries, sections, body, tocBase)
  return createBook({
    title: pickMeta('dc:title') || path.basename(filename, path.extname(filename)),
    author: pickMeta('dc:creator'),
    format: 'epub',
    text: body,
    chapters: tocChapters || chaptersFromSections(sections),
  })
}

async function parsePdf(buffer, filename) {
  let pdfjs
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  } catch {
    throw new Error('缺少 pdfjs-dist 依赖，请在插件目录执行 npm install')
  }
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise
  let info = {}
  try { info = (await doc.getMetadata())?.info || {} } catch { info = {} }
  const sections = []
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items.map(item => item.str || '').join(' ').replace(/\s+/g, ' ')
    if (text.trim()) sections.push({ title: `第 ${pageNumber} 页`, text })
  }
  try { doc.destroy() } catch { /* ignore */ }
  const chapters = chaptersFromSections(sections)
  const text = sections.map(section => section.text).join('\n\n')
  return createBook({
    title: String(info.Title || '').trim() || path.basename(filename, path.extname(filename)),
    author: String(info.Author || '').trim(),
    format: 'pdf',
    text,
    chapters,
  })
}

export async function importFile(filePath) {
  const absolute = path.resolve(String(filePath || ''))
  const ext = path.extname(absolute).toLowerCase()
  const buffer = await fs.readFile(absolute)
  if (ext === '.txt' || ext === '.md' || ext === '.markdown') return parseTxt(buffer, absolute)
  if (ext === '.docx') return parseDocx(buffer, absolute)
  if (ext === '.epub') return parseEpub(buffer, absolute)
  if (ext === '.pdf') return parsePdf(buffer, absolute)
  if (ext === '.doc') throw new Error('暂不支持旧版 .doc，请先用 Word 另存为 .docx')
  throw new Error(`不支持的格式：${ext || '未知'}（支持 txt/docx/epub/pdf）`)
}
