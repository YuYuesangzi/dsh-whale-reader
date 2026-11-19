import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStore } from './lib/store.mjs'
import { importFile } from './lib/import.mjs'

const PKG_DIR = path.dirname(fileURLToPath(import.meta.url))
const BASE = '/dsh-whale-reader'
export const inject = ['tools', 'webServer']

export function apply(ctx, config = {}) {
  const configured = typeof config.dataDir === 'string' ? config.dataDir.trim() : ''
  const dataDir = configured
    ? (path.isAbsolute(configured) ? configured : path.resolve(PKG_DIR, configured))
    : path.join(PKG_DIR, 'data')
  const store = createStore(dataDir)

  const textResult = text => ({ text })

  function registerTool(definition) {
    return ctx.effect(() => ctx.tools.register(definition), `dsh-whale-reader.tool.${definition.name}`)
  }

  registerTool({
    name: 'reader_list_books',
    description: 'List the local book library and reading progress. Returns book ids for reader_read, reader_search and reader_progress.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: {
          text: { type: 'string' },
          books: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                author: { type: 'string' },
                format: { type: 'string' },
                chapterCount: { type: 'number' },
                percent: { type: 'number' },
              },
            },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute() {
      const books = await store.listBooks()
      const lines = books.length
        ? books.map(book => {
            const progress = book.progress ? ` · 读到第 ${book.progress.chapter + 1} 章 ${Math.round(book.progress.percent)}%` : ' · 未读'
            return `- ${book.id} · 《${book.title}》${book.author ? `（${book.author}）` : ''} · ${book.format} · ${book.chapterCount} 章${progress}`
          })
        : ['书库还是空的，可以用 reader_import 导入本地文件。']
      return {
        ...textResult([
          `本地书库：${dataDir}`,
          ...lines,
        ].join('\n')),
        books: books.map(book => ({
          id: book.id,
          title: book.title,
          author: book.author,
          format: book.format,
          chapterCount: book.chapterCount,
          percent: book.progress?.percent || 0,
        })),
      }
    },
  })

  registerTool({
    name: 'reader_search',
    description: 'Search the full text of the local library. Returns short snippets and chapter numbers; use reader_read to open one.',
    parameters: {
      query: { type: 'string', description: 'Text to search for.' },
      limit: { type: 'number', description: 'Maximum results, default 20, maximum 100.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: {
          text: { type: 'string' },
          results: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                bookId: { type: 'string' },
                title: { type: 'string' },
                chapter: { type: 'number' },
                chapterTitle: { type: 'string' },
                offset: { type: 'number' },
                snippet: { type: 'string' },
              },
            },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args) {
      const results = await store.search(args?.query, { limit: args?.limit })
      const lines = results.length
        ? results.map((item, index) => `${index + 1}. ${item.bookId} · 《${item.title}》第 ${item.chapter + 1} 章 ${item.chapterTitle}\n   …${item.snippet}…`)
        : [`没有找到「${String(args?.query || '').trim()}」。`]
      return { ...textResult(lines.join('\n')), results }
    },
  })

  registerTool({
    name: 'reader_read',
    description: 'Read one chapter of a library book, optionally a slice. Saves the reading position to the shared progress file. Use reader_list_books for ids.',
    parameters: {
      bookId: { type: 'string', description: 'Book id from reader_list_books.' },
      chapter: { type: 'number', description: 'Zero-based chapter number. Omit to continue from saved progress.' },
      offset: { type: 'number', description: 'Character offset inside the chapter, default 0.' },
      limit: { type: 'number', description: 'Characters to return, default 4000, maximum 12000.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: {
          text: { type: 'string' },
          bookId: { type: 'string' },
          chapter: { type: 'number' },
          chapterTitle: { type: 'string' },
          offset: { type: 'number' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args) {
      const bookId = String(args?.bookId || '').trim()
      if (!bookId) throw new Error('缺少 bookId')
      const book = await store.getBook(bookId)
      if (!book) throw new Error(`书不存在：${bookId}`)
      const progress = book.progress || { chapter: 0, offset: 0 }
      const chapter = args?.chapter === undefined ? progress.chapter : Number(args.chapter)
      const data = await store.readChapter(bookId, chapter)
      const offset = Math.min(Math.max(0, Number(args?.offset ?? (args?.chapter === undefined ? progress.offset : 0)) || 0), data.chapter.text.length)
      const limit = Math.min(12000, Math.max(200, Number(args?.limit) || 4000))
      const slice = data.chapter.text.slice(offset, offset + limit)
      await store.saveProgress(bookId, { chapter: data.chapter.index, offset })
      const more = offset + limit < data.chapter.text.length ? `\n\n（本章还有 ${data.chapter.text.length - offset - limit} 字，继续读请把 offset 设为 ${offset + limit}）` : ''
      return {
        text: `《${book.title}》· 第 ${data.chapter.index + 1}/${data.totalChapters} 章 · ${data.chapter.title}\n\n${slice}${more}`,
        bookId,
        chapter: data.chapter.index,
        chapterTitle: data.chapter.title,
        offset,
      }
    },
  })

  registerTool({
    name: 'reader_progress',
    description: 'Read or update local reading progress. Omit everything to list progress for all books; give bookId to read one; also give chapter/offset/percent to save.',
    parameters: {
      bookId: { type: 'string', description: 'Book id. Omit to list all progress.' },
      chapter: { type: 'number', description: 'Zero-based chapter to save.' },
      offset: { type: 'number', description: 'Character offset inside the chapter to save.' },
      percent: { type: 'number', description: 'Optional explicit percentage 0-100.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: { text: { type: 'string' } },
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args) {
      const bookId = String(args?.bookId || '').trim()
      if (!bookId) {
        const all = await store.allProgress()
        return textResult(all.length
          ? all.map(item => `- ${item.bookId} · 《${item.title}》第 ${item.progress.chapter + 1} 章 ${Math.round(item.progress.percent)}%`).join('\n')
          : '还没有阅读进度。')
      }
      const hasUpdate = args?.chapter !== undefined || args?.offset !== undefined || args?.percent !== undefined
      if (hasUpdate) {
        const saved = await store.saveProgress(bookId, {
          chapter: args?.chapter,
          offset: args?.offset,
          percent: args?.percent,
        })
        return textResult(`已保存：${bookId} · 第 ${saved.chapter + 1} 章 · ${Math.round(saved.percent)}%`)
      }
      const book = await store.getBook(bookId)
      if (!book) throw new Error(`书不存在：${bookId}`)
      const progress = book.progress
      return textResult(progress
        ? `《${book.title}》读到第 ${progress.chapter + 1}/${book.chapterCount} 章，${Math.round(progress.percent)}%`
        : `《${book.title}》还没有进度。`)
    },
  })

  registerTool({
    name: 'reader_import',
    description: 'Import a local txt, docx, epub or pdf file into the library. Returns the new book id and chapter count.',
    parameters: {
      path: { type: 'string', description: 'Absolute path to the book file.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: {
          text: { type: 'string' },
          bookId: { type: 'string' },
          title: { type: 'string' },
          chapterCount: { type: 'number' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args) {
      const file = String(args?.path || '').trim()
      if (!file) throw new Error('缺少 path')
      const parsed = await importFile(file)
      const result = await store.importBook(parsed)
      return {
        text: result.duplicate
          ? `这本书已经在书库里：${result.id} ·《${result.title}》，${result.chapterCount} 章。`
          : `已导入：${result.id} ·《${result.title}》，${result.chapterCount} 章。`,
        bookId: result.id,
        title: result.title,
        chapterCount: result.chapterCount,
      }
    },
  })

  registerTool({
    name: 'reader_notes',
    description: 'List notes for a book, or add a note when excerpt/note is given. Notes are stored in the shared notes.json file.',
    parameters: {
      bookId: { type: 'string', description: 'Book id; omit to list all notes.' },
      chapter: { type: 'number', description: 'Zero-based chapter for a new note.' },
      excerpt: { type: 'string', description: 'Quoted text for a new note.' },
      note: { type: 'string', description: 'Note body for a new note.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: { text: { type: 'string' } },
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args) {
      const bookId = String(args?.bookId || '').trim()
      if (bookId && (args?.excerpt || args?.note)) {
        const note = await store.addNote({
          bookId,
          chapter: args?.chapter,
          excerpt: args?.excerpt,
          note: args?.note,
        })
        return textResult(`已记下：${note.id} · 第 ${note.chapter + 1} 章`)
      }
      const notes = await store.listNotes(bookId)
      return textResult(notes.length
        ? notes.map(note => `- ${note.id} · ${note.bookId} 第 ${note.chapter + 1} 章${note.excerpt ? `\n  摘录：${note.excerpt}` : ''}${note.note ? `\n  笔记：${note.note}` : ''}`).join('\n')
        : '还没有笔记。')
    },
  })

  async function sendJson(res, status, value) {
    const body = JSON.stringify(value)
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
    })
    res.end(body)
  }

  async function readBody(req) {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > 1_000_000) throw new Error('请求体太大')
      chunks.push(chunk)
    }
    if (!size) return {}
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  }

  async function readRawBody(req, max = 100 * 1024 * 1024) {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > max) throw new Error('文件太大（上限 100 MB）')
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  async function handler(req, res) {
    try {
      const url = new URL(req.url || '/', 'http://localhost')
      const pathname = decodeURIComponent(url.pathname)
      if (!pathname.startsWith(`${BASE}/api/`)) {
        await sendJson(res, 404, { error: 'not found' })
        return
      }

      const api = pathname.slice(BASE.length)
      if (req.method === 'POST' && api === '/api/import') {
        const name = path.basename(String(url.searchParams.get('name') || '').trim())
        if (!name) throw new Error('缺少文件名')
        const ext = path.extname(name).toLowerCase()
        if (!['.txt', '.md', '.markdown', '.docx', '.epub', '.pdf'].includes(ext)) {
          throw new Error(`不支持的格式：${ext || '未知'}（支持 txt/docx/epub/pdf）`)
        }
        const data = await readRawBody(req)
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-whale-import-'))
        const tempFile = path.join(tempDir, `book${ext}`)
        try {
          await fs.writeFile(tempFile, data)
          const parsed = await importFile(tempFile)
          const fallbackTitle = path.basename(name, ext)
          if (!parsed.title || parsed.title === path.basename(tempFile, ext)) parsed.title = fallbackTitle
          const result = await store.importBook(parsed)
          await sendJson(res, 200, { book: await store.getBook(result.id), duplicate: result.duplicate })
        } finally {
          await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
        }
        return
      }
      if (req.method === 'GET' && api === '/api/books') {
        await sendJson(res, 200, { books: await store.listBooks() })
        return
      }
      const bookMatch = /^\/api\/books\/([^/]+)$/.exec(api)
      if (req.method === 'GET' && bookMatch) {
        const book = await store.getBook(bookMatch[1])
        if (!book) return sendJson(res, 404, { error: '书不存在' })
        await sendJson(res, 200, { book })
        return
      }
      const chapterMatch = /^\/api\/books\/([^/]+)\/chapter$/.exec(api)
      if (req.method === 'GET' && chapterMatch) {
        const chapter = await store.readChapter(chapterMatch[1], Number(url.searchParams.get('idx') || 0))
        await sendJson(res, 200, chapter)
        return
      }
      if (api === '/api/progress') {
        if (req.method === 'GET') {
          const bookId = String(url.searchParams.get('bookId') || '').trim()
          if (!bookId) {
            await sendJson(res, 200, { progress: await store.allProgress() })
            return
          }
          const book = await store.getBook(bookId)
          if (!book) return sendJson(res, 404, { error: '书不存在' })
          await sendJson(res, 200, { progress: book.progress })
          return
        }
        if (req.method === 'POST') {
          const body = await readBody(req)
          const saved = await store.saveProgress(String(body.bookId || ''), body)
          await sendJson(res, 200, { progress: saved })
          return
        }
      }
      if (req.method === 'GET' && api === '/api/search') {
        const results = await store.search(url.searchParams.get('q') || '', {
          limit: Number(url.searchParams.get('limit') || 20),
        })
        await sendJson(res, 200, { results })
        return
      }
      if (api === '/api/notes') {
        if (req.method === 'GET') {
          await sendJson(res, 200, { notes: await store.listNotes(String(url.searchParams.get('bookId') || '')) })
          return
        }
        if (req.method === 'POST') {
          const body = await readBody(req)
          const note = await store.addNote(body)
          await sendJson(res, 200, { note })
          return
        }
      }
      await sendJson(res, 404, { error: 'not found' })
    } catch (error) {
      await sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: BASE, handler }), 'dsh-whale-reader.web')
}
