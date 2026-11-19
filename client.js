window.__ModuleLoader__.load({
  id: '@local/dsh-whale-reader',
  factory(require) {
    const React = require('react')
    const { useState, useEffect, useRef } = React
    const h = React.createElement
    const API = '/dsh-whale-reader/api'

    const CSS = `
      .wr-root,.wr-root *{box-sizing:border-box}
      .wr-root{container-type:inline-size;display:flex;flex-direction:column;gap:10px;height:min(calc(100vh - 190px),760px);min-height:460px;color:inherit;font-family:inherit}
      .wr-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .wr-title{font-size:15px;font-weight:500}
      .wr-sub{font-size:12px;opacity:.55}
      .wr-btn{border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;border-radius:7px;padding:4px 9px;font:inherit;font-size:12px;cursor:pointer;opacity:.82}
      .wr-btn:hover{opacity:1;border-color:currentColor}
      .wr-btn.primary{background:color-mix(in srgb,CanvasText 10%,transparent)}
      .wr-select{height:28px;max-width:170px;border:1px solid rgba(127,127,127,.3);border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:11px;padding:0 5px;outline:none}
      .wr-search{display:flex;gap:6px;flex:1;min-width:180px;max-width:360px;margin-left:auto;position:relative}
      .wr-search input{width:100%;height:30px;padding:0 9px;border:1px solid rgba(127,127,127,.3);border-radius:7px;background:transparent;color:inherit;font:inherit;font-size:12px;outline:none}
      .wr-search input:focus{border-color:currentColor}
      .wr-results{position:absolute;top:35px;left:0;right:0;max-height:52vh;overflow:auto;z-index:80;background:Canvas;color:CanvasText;border:1px solid rgba(127,127,127,.35);border-radius:9px;box-shadow:0 12px 30px rgba(0,0,0,.18);padding:5px}
      .wr-result{padding:8px 9px;border-radius:6px;cursor:pointer}
      .wr-result:hover{background:color-mix(in srgb,CanvasText 8%,transparent)}
      .wr-result b{display:block;font-size:12px;margin-bottom:2px}
      .wr-result small{font-size:10px;opacity:.55}
      .wr-result p{margin:4px 0 0;font-size:11.5px;line-height:1.55;opacity:.75}
      .wr-body{flex:1;min-height:0;width:100%;display:flex;border:1px solid rgba(127,127,127,.28);border-radius:12px;overflow:hidden;background:color-mix(in srgb,CanvasText 3%,transparent)}
      .wr-shelf{flex:0 0 160px;min-width:0;overflow:auto;border-right:1px solid rgba(127,127,127,.22);padding:7px}
      .wr-shelf-head,.wr-toc-head{display:flex;justify-content:space-between;align-items:baseline;padding:2px 7px 8px;font-size:10px;letter-spacing:.14em;opacity:.55}
      .wr-item{width:100%;text-align:left;border:0;background:transparent;color:inherit;border-radius:8px;padding:8px 9px;cursor:pointer;display:block}
      .wr-item:hover{background:color-mix(in srgb,CanvasText 7%,transparent)}
      .wr-item.active{background:rgba(31,75,63,.82);color:#f7f2e6}
      .wr-item .t{display:block;font-size:12.5px;line-height:1.4}
      .wr-item .m{display:block;margin-top:3px;font-size:10px;opacity:.6}
      .wr-item.active .m{opacity:.75}
      .wr-item .p{height:2px;margin-top:6px;background:currentColor;opacity:.18;border-radius:2px;overflow:hidden}
      .wr-item .p i{display:block;height:100%;background:currentColor;opacity:.8}
      .wr-main{flex:1 1 auto;min-width:0;min-height:0;display:flex;flex-direction:column}
      .wr-crumb{padding:10px 22px 6px;font-size:11px;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .wr-content{display:block;width:100%;min-width:0;flex:1;min-height:0;overflow:auto;padding:8px 30px 40px;scroll-behavior:smooth}
      .wr-prose{display:block;width:100%;min-width:0;max-width:720px;margin:0 auto;white-space:pre-wrap;word-break:break-word;font-family:"Noto Serif SC","Songti SC","SimSun",Georgia,serif;font-size:17px;line-height:2.02}
      .wr-empty{max-width:560px;margin:10vh auto 0;font-size:13px;line-height:1.9;opacity:.7}
      .wr-empty h2{font-size:22px;font-weight:500;color:CanvasText;opacity:1;margin:0 0 12px}
      .wr-pager{height:44px;border-top:1px solid rgba(127,127,127,.22);display:flex;align-items:center;gap:10px;padding:0 12px}
      .wr-page{border:1px solid rgba(127,127,127,.3);background:transparent;color:inherit;border-radius:6px;height:27px;padding:0 9px;font:inherit;font-size:11px;cursor:pointer}
      .wr-page:hover{border-color:currentColor}
      .wr-bar{flex:1;height:3px;border-radius:3px;background:rgba(127,127,127,.25);overflow:hidden}
      .wr-bar i{display:block;height:100%;background:currentColor;opacity:.6;transition:width .2s linear}
      .wr-pct{font-size:10px;opacity:.55;min-width:56px;text-align:right}
      .wr-toc{flex:0 0 150px;min-width:0;overflow:auto;border-left:1px solid rgba(127,127,127,.22);padding:7px}
      .wr-toc-item{width:100%;text-align:left;border:0;background:transparent;color:inherit;border-radius:6px;padding:6px 7px;font-size:11px;line-height:1.4;cursor:pointer;opacity:.75}
      .wr-toc-item:hover{background:color-mix(in srgb,CanvasText 7%,transparent);opacity:1}
      .wr-toc-item.active{background:rgba(31,75,63,.82);color:#f7f2e6;opacity:1}
      .wr-notice{min-height:16px;font-size:11px;opacity:.65}
      .wr-loading{font-size:12px;opacity:.55;padding:8px 0}
      .wr-body.library{display:flex}
      .wr-library{flex:1;min-height:0;overflow:auto;padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;align-content:start;background:color-mix(in srgb,CanvasText 3%,transparent)}
      .wr-lib-head{grid-column:1/-1;display:flex;justify-content:space-between;align-items:baseline;padding:2px 3px 8px;font-size:10px;letter-spacing:.14em;opacity:.55}
      .wr-book{display:flex;flex-direction:column;gap:6px;text-align:left;border:1px solid rgba(127,127,127,.28);background:color-mix(in srgb,CanvasText 3%,transparent);color:inherit;border-radius:10px;padding:12px;cursor:pointer;min-width:0}
      .wr-book:hover{border-color:currentColor;background:color-mix(in srgb,CanvasText 7%,transparent)}
      .wr-book-title{font-size:13px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .wr-book-meta{font-size:10px;opacity:.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .wr-book-bar{height:2px;border-radius:2px;background:rgba(127,127,127,.25);overflow:hidden}
      .wr-book-bar i{display:block;height:100%;background:currentColor;opacity:.55}
      @media(max-width:900px){.wr-toc{display:none}.wr-shelf{flex-basis:140px}.wr-content{padding:8px 20px 34px}}
      @container (max-width:760px){.wr-toc{display:none}.wr-shelf{flex-basis:140px}.wr-content{padding:8px 20px 34px}.wr-prose{font-size:16.5px}}
      @container (max-width:600px){.wr-shelf{display:none}.wr-content{padding:8px 16px 30px}}
      @media(max-width:680px){.wr-shelf{display:none}.wr-content{padding:8px 16px 30px}.wr-prose{font-size:16px}}
    `

    async function api(path, options = {}) {
      const response = await fetch(`${API}${path}`, {
        headers: options.body ? { 'content-type': 'application/json' } : undefined,
        ...options,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `请求失败（${response.status}）`)
      return data
    }

    function totalChars(book) {
      return Math.max(1, (book?.chapters || []).reduce((sum, item) => sum + (item.chars || 0), 0))
    }

    function percentOf(book, index, offset) {
      const chapters = book?.chapters || []
      const start = chapters.slice(0, index).reduce((sum, item) => sum + (item.chars || 0), 0)
      return Math.min(100, Math.max(0, (start + offset) / totalChars(book) * 100))
    }

    function BookIcon({ size = 18, active }) {
      const s = Number(size) || 18
      return h('svg', {
        width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
        style: { display: 'block', opacity: active ? 1 : 0.75 },
      },
        h('path', { d: 'M4 5.5c3-1 6-.4 8 1.2 2-1.6 5-2.2 8-1.2v13c-3-1-6-.4-8 1.2-2-1.6-5-2.2-8-1.2v-13z' }),
        h('path', { d: 'M12 6.7v13' }),
      )
    }

    function ReaderSettings() {
      const [books, setBooks] = useState([])
      const [book, setBook] = useState(null)
      const [chapter, setChapter] = useState(null)
      const [index, setIndex] = useState(0)
      const [percent, setPercent] = useState(0)
      const [query, setQuery] = useState('')
      const [results, setResults] = useState(null)
      const [notice, setNotice] = useState('')
      const [loading, setLoading] = useState(true)
      const [dragging, setDragging] = useState(false)
      const [showLibrary, setShowLibrary] = useState(false)
      const [restore, setRestore] = useState({ offset: 0, nonce: 0 })

      const scrollRef = useRef(null)
      const fileRef = useRef(null)
      const saveTimer = useRef(0)
      const noticeTimer = useRef(0)
      const suppress = useRef(false)
      const current = useRef({ book: null, index: 0, text: '' })

      useEffect(() => () => {
        clearTimeout(saveTimer.current)
        clearTimeout(noticeTimer.current)
      }, [])

      function notify(message) {
        setNotice(message)
        clearTimeout(noticeTimer.current)
        noticeTimer.current = setTimeout(() => setNotice(''), 2600)
      }

      async function loadBooks() {
        const data = await api('/books')
        const list = data.books || []
        setBooks(list)
        return list
      }

      async function save(b, chapterIndex, offset) {
        if (!b) return
        const value = Math.min(Math.max(0, offset), current.current.text.length || 0)
        const pct = percentOf(b, chapterIndex, value)
        setPercent(pct)
        setBooks(previous => previous.map(item => item.id === b.id
          ? { ...item, progress: { chapter: chapterIndex, offset: value, percent: pct, updatedAt: Date.now() } }
          : item))
        try {
          await fetch(`${API}/progress`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ bookId: b.id, chapter: chapterIndex, offset: value, percent: pct }),
            keepalive: true,
          })
        } catch { /* reading still works if the write fails */ }
      }

      async function loadChapter(b, nextIndex, offset = 0) {
        const data = await api(`/books/${encodeURIComponent(b.id)}/chapter?idx=${nextIndex}`)
        const next = data.chapter
        setChapter(next)
        setIndex(next.index)
        setRestore({ offset, nonce: Date.now() })
        current.current = { book: b, index: next.index, text: next.text || '' }
        setPercent(percentOf(b, next.index, offset))
        void save(b, next.index, offset)
      }

      async function openBook(id, chapterIndex, offset) {
        setShowLibrary(false)
        setLoading(true)
        try {
          const data = await api(`/books/${encodeURIComponent(id)}`)
          const nextBook = data.book
          setBook(nextBook)
          setBooks(previous => previous.map(item => item.id === nextBook.id ? { ...item, ...nextBook } : item))
          const nextIndex = chapterIndex === undefined ? (nextBook.progress?.chapter || 0) : chapterIndex
          const nextOffset = offset === undefined ? (nextBook.progress?.offset || 0) : offset
          await loadChapter(nextBook, nextIndex, nextOffset)
        } catch (error) {
          notify(error.message)
        } finally {
          setLoading(false)
        }
      }

      useEffect(() => {
        let live = true
        ;(async () => {
          try {
            const list = await loadBooks()
            if (live && list[0]) await openBook(list[0].id)
          } catch (error) {
            if (live) notify(error.message)
          } finally {
            if (live) setLoading(false)
          }
        })()
        return () => { live = false }
      }, [])

      useEffect(() => {
        const element = scrollRef.current
        if (!element || !chapter) return
        suppress.current = true
        element.scrollTop = 0
        const frame = requestAnimationFrame(() => {
          const max = element.scrollHeight - element.clientHeight
          const ratio = chapter.text ? Math.min(1, Math.max(0, restore.offset / chapter.text.length)) : 0
          if (max > 0) element.scrollTop = max * ratio
          setTimeout(() => { suppress.current = false }, 300)
        })
        return () => cancelAnimationFrame(frame)
      }, [chapter, restore])

      function onScroll() {
        if (suppress.current || !book || !chapter) return
        const element = scrollRef.current
        if (!element) return
        const max = element.scrollHeight - element.clientHeight
        const offset = max > 0 ? Math.round(element.scrollTop / max * chapter.text.length) : 0
        setPercent(percentOf(book, index, offset))
        clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => { void save(book, index, offset) }, 700)
      }

      function turnPage(direction) {
        if (!book || !chapter) return
        const element = scrollRef.current
        if (!element) return
        const max = element.scrollHeight - element.clientHeight
        if (direction > 0) {
          if (element.scrollTop < max - 8) {
            element.scrollBy({ top: element.clientHeight * 0.82, behavior: 'smooth' })
          } else if (index < (book.chapters?.length || 0) - 1) {
            void loadChapter(book, index + 1, 0)
          } else {
            void save(book, index, chapter.text.length)
            notify('已经是最后一页')
          }
        } else if (element.scrollTop > 8) {
          element.scrollBy({ top: -element.clientHeight * 0.82, behavior: 'smooth' })
        } else if (index > 0) {
          void loadChapter(book, index - 1, 0)
        } else {
          notify('已经是第一页')
        }
      }

      async function doSearch() {
        if (!query.trim()) { setResults(null); return }
        try {
          const data = await api(`/search?q=${encodeURIComponent(query.trim())}&limit=24`)
          setResults(data.results || [])
        } catch (error) {
          notify(error.message)
        }
      }

      async function importFiles(fileList) {
        const files = Array.from(fileList || []).filter(Boolean)
        if (!files.length) return
        let last = null
        let count = 0
        for (const file of files) {
          notify(`正在导入 ${file.name}…`)
          try {
            const response = await fetch(`${API}/import?name=${encodeURIComponent(file.name)}`, {
              method: 'POST',
              headers: { 'content-type': 'application/octet-stream' },
              body: file,
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data.error || `导入失败（${response.status}）`)
            last = data.book
            count += 1
          } catch (error) {
            notify(`${file.name} 导入失败：${error.message}`)
          }
        }
        const list = await loadBooks()
        if (last) {
          await openBook(last.id, 0)
        } else if (list[0] && !book) {
          await openBook(list[0].id)
        }
        if (count) notify(`已导入 ${count} 个文件`)
      }

      const chapters = book?.chapters || []

      return h('div', {
        className: 'wr-root',
        onDragEnter: (event) => {
          if (!event.dataTransfer?.types?.includes('Files')) return
          event.preventDefault()
          setDragging(true)
        },
        onDragOver: (event) => {
          if (!event.dataTransfer?.types?.includes('Files')) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        },
        onDragLeave: (event) => {
          if (event.currentTarget.contains(event.relatedTarget)) return
          setDragging(false)
        },
        onDrop: (event) => {
          if (!event.dataTransfer?.files?.length) return
          event.preventDefault()
          setDragging(false)
          void importFiles(event.dataTransfer.files)
        },
        style: dragging ? { outline: '2px dashed currentColor', outlineOffset: 3, borderRadius: 12 } : undefined,
      },
        h('style', null, CSS),
        h('div', { className: 'wr-head' },
          h('div', null,
            h('div', { className: 'wr-title' }, '源阅书架'),
            h('div', { className: 'wr-sub' }, '本地文件 · 和 agent 共用进度'),
          ),
          h('button', {
            className: 'wr-btn primary',
            type: 'button',
            onClick: () => fileRef.current?.click(),
          }, '＋ 导入'),
          !showLibrary ? h('button', { className: 'wr-btn', type: 'button', onClick: () => { setShowLibrary(true); setBook(null); setChapter(null); setResults(null); setQuery('') } }, '← 书架') : null,
          chapters.length > 1 ? h('select', {
            className: 'wr-select',
            value: index,
            title: '选择章节',
            onChange: (event) => { void loadChapter(book, Number(event.target.value), 0) },
          }, chapters.map((item, i) => h('option', { key: i, value: i }, item.title || `第 ${i + 1} 节`))) : null,
          h('div', { className: 'wr-search' },
            h('input', {
              value: query,
              placeholder: '搜索全文…',
              onChange: (event) => setQuery(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') { event.preventDefault(); void doSearch() }
                if (event.key === 'Escape') setResults(null)
              },
            }),
            results ? h('div', { className: 'wr-results' },
              results.length
                ? results.map((result, i) => h('div', {
                    key: `${result.bookId}-${result.chapter}-${i}`,
                    className: 'wr-result',
                    onClick: () => {
                      setResults(null)
                      void openBook(result.bookId, result.chapter, result.offset)
                    },
                  },
                    h('b', null, `《${result.title}》 · ${result.chapterTitle}`),
                    h('small', null, result.bookId),
                    h('p', null, `…${result.snippet}…`),
                  ))
                : h('div', { className: 'wr-result' }, h('b', null, '没有找到')),
            ) : null,
          ),
        ),
        h('input', {
          ref: fileRef,
          type: 'file',
          multiple: true,
          accept: '.txt,.md,.markdown,.docx,.epub,.pdf',
          style: { display: 'none' },
          onChange: (event) => {
            const files = event.target.files
            event.target.value = ''
            void importFiles(files)
          },
        }),
        h('div', { className: 'wr-body' + (showLibrary ? ' library' : '') },
          showLibrary
            ? h('div', { className: 'wr-library' },
                h('div', { className: 'wr-lib-head' }, h('span', null, '全部图书'), h('span', null, books.length ? books.length + ' 本' : '')),
                books.length
                  ? books.map(item => {
                      const pct = item.progress?.percent || 0
                      return h('button', {
                        key: item.id, type: 'button', className: 'wr-book',
                        onClick: () => { void openBook(item.id) },
                      },
                        h('span', { className: 'wr-book-title' }, item.title),
                        h('span', { className: 'wr-book-meta' }, [item.author, item.format, item.chapterCount ? item.chapterCount + ' 章' : ''].filter(Boolean).join(' · ')),
                        h('span', { className: 'wr-book-bar' }, h('i', { style: { width: Math.max(0, Math.min(100, pct)) + '%' } })),
                      )
                    })
                  : h('div', { className: 'wr-empty', style: { margin: '20px 4px', fontSize: 12 } }, '书库为空，点「＋ 导入」或把文件拖进来。'),
              )
            : h(React.Fragment, null,
          h('aside', { className: 'wr-shelf' },
            h('div', { className: 'wr-shelf-head' }, h('span', null, '书架'), h('span', null, books.length ? `${books.length} 本` : '')),
            books.length
              ? books.map(item => {
                  const pct = item.progress?.percent || 0
                  return h('button', {
                    key: item.id,
                    type: 'button',
                    className: `wr-item${book?.id === item.id ? ' active' : ''}`,
                    onClick: () => { void openBook(item.id) },
                  },
                    h('span', { className: 't' }, item.title),
                    h('span', { className: 'm' }, [item.author, item.format, item.chapterCount ? `${item.chapterCount} 章` : ''].filter(Boolean).join(' · ')),
                    h('span', { className: 'p' }, h('i', { style: { width: `${Math.max(0, Math.min(100, pct))}%` } })),
                  )
                })
              : h('div', { className: 'wr-empty', style: { margin: '18px 6px', fontSize: 12 } }, '书库为空，点「＋ 导入」或把文件拖进来。'),
          ),
          h('main', { className: 'wr-main' },
            h('div', { className: 'wr-crumb' }, chapter ? `${book?.title || ''} / ${chapter.title}` : '选择一本书开始'),
            h('div', { className: 'wr-content', ref: scrollRef, onScroll },
              loading && !chapter
                ? h('div', { className: 'wr-loading' }, '正在打开…')
                : chapter
                  ? h('div', { className: 'wr-prose' }, chapter.text || '这一章没有可显示的文字。')
                  : h('div', { className: 'wr-empty' },
                      h('h2', null, '源阅书架'),
                      h('p', null, '把书放在本地文件里，和 DSH 的 agent 共用同一份阅读进度。'),
                      h('p', null, '点上方「＋ 导入」，或直接把 TXT / DOCX / EPUB / PDF 拖进这里。'),
                    ),
            ),
            h('div', { className: 'wr-pager' },
              h('button', { className: 'wr-page', type: 'button', onClick: () => turnPage(-1) }, '上一页'),
              h('div', { className: 'wr-bar' }, h('i', { style: { width: `${percent.toFixed(1)}%` } })),
              h('span', { className: 'wr-pct' }, chapters.length ? `第 ${index + 1}/${chapters.length} 章 · ${Math.round(percent)}%` : '0%'),
              h('button', { className: 'wr-page', type: 'button', onClick: () => turnPage(1) }, '下一页'),
            ),
          ),
          h('aside', { className: 'wr-toc' },
            h('div', { className: 'wr-toc-head' }, h('span', null, '目录')),
            chapters.map((item, i) => h('button', {
              key: `${i}-${item.title}`,
              type: 'button',
              className: `wr-toc-item${i === index ? ' active' : ''}`,
              onClick: () => { void loadChapter(book, i, 0) },
            }, item.title || `第 ${i + 1} 节`)),
          ),
          ),
        ),
        h('div', { className: 'wr-notice' }, notice),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'dsh-whale-reader',
          order: 35,
          label: () => '源阅书架',
        }, ReaderSettings))

        ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon',
          id: 'dsh-whale-reader',
          order: 35,
        }, BookIcon))
      },
    }
  },
})
