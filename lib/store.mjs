import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const FILES = {
  index: 'index.json',
  progress: 'progress.json',
  notes: 'notes.json',
}

const EMPTY = {
  index: { version: 1, books: [] },
  progress: { version: 1, books: {} },
  notes: { version: 1, notes: [] },
}

function cleanText(value, max = 200) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function numberOr(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * A tiny file-backed library. index.json holds metadata and chapter offsets,
 * progress.json and notes.json are shared by the agent tools and the page.
 */
export function createStore(dataDir) {
  const dir = path.resolve(dataDir)
  let ready
  let queue = Promise.resolve()

  const file = name => path.join(dir, FILES[name])

  async function writeJson(name, value) {
    const target = file(name)
    const tmp = `${target}.${process.pid}.tmp`
    await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await fs.rename(tmp, target)
  }

  async function readJson(name) {
    try {
      const value = JSON.parse(await fs.readFile(file(name), 'utf8'))
      return value && typeof value === 'object' ? value : structuredClone(EMPTY[name])
    } catch {
      return structuredClone(EMPTY[name])
    }
  }

  async function ensure() {
    if (!ready) {
      ready = (async () => {
        await fs.mkdir(dir, { recursive: true })
        for (const name of Object.keys(FILES)) {
          try {
            await fs.access(file(name))
          } catch {
            await writeJson(name, EMPTY[name])
          }
        }
      })().catch((error) => {
        ready = undefined
        throw error
      })
    }
    return ready
  }

  function mutate(fn) {
    const run = queue.then(async () => {
      await ensure()
      return fn()
    })
    queue = run.catch(() => {})
    return run
  }

  async function readIndex() {
    const index = await readJson('index')
    if (!Array.isArray(index.books)) index.books = []
    return index
  }

  async function readProgress() {
    const progress = await readJson('progress')
    if (!progress.books || typeof progress.books !== 'object') progress.books = {}
    return progress
  }

  async function readNotes() {
    const notes = await readJson('notes')
    if (!Array.isArray(notes.notes)) notes.notes = []
    return notes
  }

  function progressFor(progress, id) {
    const item = progress.books[id]
    if (!item || typeof item !== 'object') return null
    return {
      chapter: Math.max(0, numberOr(item.chapter)),
      offset: Math.max(0, numberOr(item.offset)),
      percent: Math.min(100, Math.max(0, numberOr(item.percent))),
      updatedAt: numberOr(item.updatedAt),
    }
  }

  function publicBook(book, progress) {
    return {
      id: book.id,
      title: book.title,
      author: book.author || '',
      format: book.format,
      bytes: numberOr(book.bytes),
      addedAt: numberOr(book.addedAt),
      chapterCount: Array.isArray(book.chapters) ? book.chapters.length : 0,
      chapters: (book.chapters || []).map((chapter) => ({
        title: chapter.title || '',
        chars: Math.max(0, numberOr(chapter.end) - numberOr(chapter.start)),
      })),
      progress: progressFor(progress, book.id),
    }
  }

  async function listBooks() {
    await ensure()
    const [index, progress] = await Promise.all([readIndex(), readProgress()])
    const books = index.books.map(book => publicBook(book, progress))
    books.sort((a, b) => (b.progress?.updatedAt || b.addedAt) - (a.progress?.updatedAt || a.addedAt))
    return books
  }

  async function getBook(id) {
    await ensure()
    const [index, progress] = await Promise.all([readIndex(), readProgress()])
    const book = index.books.find(item => item.id === id)
    if (!book) return null
    return {
      ...publicBook(book, progress),
      textFile: `${book.id}.txt`,
    }
  }

  async function readText(book) {
    return fs.readFile(path.join(dir, `${book.id}.txt`), 'utf8')
  }

  async function readChapter(id, chapterIndex = 0) {
    const book = await getBook(id)
    if (!book) throw new Error(`书不存在：${id}`)
    const index = await readIndex()
    const row = index.books.find(item => item.id === id)
    const chapters = row?.chapters || []
    const idx = Math.min(Math.max(0, numberOr(chapterIndex)), Math.max(0, chapters.length - 1))
    const chapter = chapters[idx] || { title: '正文', start: 0, end: 0 }
    const text = await readText(row)
    const offset = Math.max(0, numberOr(chapter.start))
    const end = Math.max(offset, Math.min(text.length, numberOr(chapter.end, text.length)))
    return {
      bookId: id,
      title: row.title,
      chapter: {
        index: idx,
        title: chapter.title || `第 ${idx + 1} 节`,
        text: text.slice(offset, end),
        chars: end - offset,
      },
      totalChapters: chapters.length,
      progress: progressFor(await readProgress(), id),
    }
  }

  async function saveProgress(id, patch = {}) {
    return mutate(async () => {
      const index = await readIndex()
      const row = index.books.find(item => item.id === id)
      if (!row) throw new Error(`书不存在：${id}`)
      const progress = await readProgress()
      const previous = progressFor(progress, id) || { chapter: 0, offset: 0, percent: 0 }
      const chapter = Math.min(
        Math.max(0, numberOr(patch.chapter, previous.chapter)),
        Math.max(0, (row.chapters || []).length - 1),
      )
      const offset = Math.max(0, numberOr(patch.offset, previous.offset))
      const totalChars = Math.max(1, numberOr(row.chars, 1))
      const computed = ((row.chapters[chapter]?.start || 0) + offset) / totalChars * 100
      const percent = patch.percent === undefined
        ? Math.min(100, Math.max(0, computed))
        : Math.min(100, Math.max(0, numberOr(patch.percent, computed)))
      progress.books[id] = { chapter, offset, percent, updatedAt: Date.now() }
      await writeJson('progress', progress)
      return progress.books[id]
    })
  }

  async function allProgress() {
    await ensure()
    const [index, progress] = await Promise.all([readIndex(), readProgress()])
    return index.books
      .map(book => ({ bookId: book.id, title: book.title, progress: progressFor(progress, book.id) }))
      .filter(item => item.progress)
  }

  async function search(query, { limit = 20 } = {}) {
    const q = String(query || '').trim()
    if (!q) return []
    await ensure()
    const index = await readIndex()
    const results = []
    const max = Math.min(100, Math.max(1, numberOr(limit, 20)))
    for (const book of index.books) {
      if (results.length >= max) break
      let text = ''
      try { text = await readText(book) } catch { continue }
      const haystack = text.toLowerCase()
      const needle = q.toLowerCase()
      let from = 0
      while (results.length < max) {
        const at = haystack.indexOf(needle, from)
        if (at < 0) break
        const chapterIndex = (book.chapters || []).findIndex(chapter => at >= chapter.start && at < chapter.end)
        const chapter = book.chapters?.[chapterIndex] || { title: '正文', start: 0, end: text.length }
        const start = Math.max(0, at - 70)
        const end = Math.min(text.length, at + q.length + 110)
        results.push({
          bookId: book.id,
          title: book.title,
          chapter: Math.max(0, chapterIndex),
          chapterTitle: chapter.title || '正文',
          offset: Math.max(0, at - numberOr(chapter.start)),
          snippet: text.slice(start, end).replace(/\s+/g, ' ').trim(),
        })
        from = at + Math.max(1, needle.length)
      }
    }
    return results
  }

  async function listNotes(bookId = '') {
    await ensure()
    const notes = await readNotes()
    return notes.notes.filter(note => !bookId || note.bookId === bookId)
  }

  async function addNote({ bookId, chapter = 0, excerpt = '', note = '' }) {
    if (!bookId) throw new Error('缺少 bookId')
    await ensure()
    const book = await getBook(bookId)
    if (!book) throw new Error(`书不存在：${bookId}`)
    return mutate(async () => {
      const notes = await readNotes()
      const item = {
        id: crypto.randomUUID(),
        bookId,
        chapter: Math.max(0, numberOr(chapter)),
        excerpt: cleanText(excerpt, 500),
        note: cleanText(note, 2000),
        createdAt: Date.now(),
      }
      notes.notes.push(item)
      await writeJson('notes', notes)
      return item
    })
  }

  async function removeNote(id) {
    return mutate(async () => {
      const notes = await readNotes()
      const before = notes.notes.length
      notes.notes = notes.notes.filter(note => note.id !== id)
      if (notes.notes.length !== before) await writeJson('notes', notes)
      return { removed: before !== notes.notes.length }
    })
  }

  async function importBook(parsed) {
    const title = cleanText(parsed.title || '未命名', 200)
    const author = cleanText(parsed.author || '', 120)
    const text = String(parsed.text || '').replace(/\r\n?/g, '\n').trim()
    if (!text) throw new Error('没有提取到正文')
    const chapters = (parsed.chapters || []).map((chapter) => ({
      title: cleanText(chapter.title || '正文', 120),
      start: Math.max(0, numberOr(chapter.start)),
      end: Math.max(0, numberOr(chapter.end)),
    })).filter(chapter => chapter.end > chapter.start)
    const id = crypto.createHash('sha1').update(`${title}\n${author}\n${text}`).digest('hex').slice(0, 12)
    return mutate(async () => {
      const index = await readIndex()
      const existing = index.books.find(book => book.id === id)
      if (existing) {
        return { id, title: existing.title, duplicate: true, chapterCount: existing.chapters?.length || 0 }
      }
      await fs.writeFile(path.join(dir, `${id}.txt`), text, 'utf8')
      const book = {
        id,
        title,
        author,
        format: cleanText(parsed.format || 'txt', 20),
        bytes: Buffer.byteLength(text, 'utf8'),
        chars: text.length,
        addedAt: Date.now(),
        chapters,
      }
      index.books.push(book)
      await writeJson('index', index)
      return { id, title, duplicate: false, chapterCount: chapters.length }
    })
  }

  return {
    dir,
    ensure,
    listBooks,
    getBook,
    readChapter,
    saveProgress,
    allProgress,
    search,
    listNotes,
    addNote,
    removeNote,
    importBook,
  }
}
