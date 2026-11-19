# 源阅书架 · DSH 插件

把书放在本地文件里，给 DSH 的 agent 一套查书、检索、按段读和记进度的工具，并在设置里提供一个原生阅读面板。

- 不依赖浏览器 IndexedDB
- 不经过独立网页，也不是 iframe
- 不调用任何 AI 接口
- 书、进度、笔记都在本机文件里

## 功能

- 设置左侧导航「源阅书架」原生 React 面板
- 书架、全文搜索、目录、上一页/下一页、进度条
- 页面右上角 `＋` 导入，或直接拖文件进面板
- agent 工具：书单、检索、按章读、进度、导入、笔记
- 页面和 agent 读写同一份 `progress.json`

## 支持格式

| 格式 | 说明 |
|---|---|
| `.txt` / `.md` | UTF-8 / UTF-16 / GB18030 自动识别 |
| `.docx` | 提取正文，不保留排版和图片 |
| `.epub` | 优先用 `toc.ncx` / `nav.xhtml` 的定位点切章，失败再按标题切 |
| `.pdf` | 提取文字，按页分章，不保留排版和图片 |

不支持旧版 `.doc`、`.mobi`、`.azw3`。单文件上限 100 MB。

## 安装

要求：DSH 0.2.2+ 的 Web profile。

```bash
git clone https://github.com/YuYuesangzi/dsh-whale-reader.git
cd dsh-whale-reader
pnpm install    # 或 npm install
```

然后在 DSH 里安装本地插件目录：

- **Plugins → Add plugin** 选择这个目录
- 或让 agent 调用：

```text
plugin_manager install_bundle target="<绝对路径>/dsh-whale-reader"
```

安装后刷新 DSH 页面，打开**设置 → 源阅书架**。

依赖：`jszip`、`mammoth`、`pdfjs-dist`。

## 使用

1. 设置 → 源阅书架
2. 右上角 `＋` 导入 TXT / DOCX / EPUB / PDF
3. 翻页、看目录、搜索；进度自动保存

agent 侧：

```text
reader_import path="D:\Books\某本书.epub"
reader_list_books
reader_search query="关键词"
reader_read bookId="..." chapter=0 offset=0 limit=4000
reader_progress bookId="..." chapter=2 offset=120
reader_notes bookId="..." excerpt="..." note="..."
```

## 数据

默认在插件目录的 `data/`：

```text
data/
├── index.json      元数据 + 章节字符区间
├── progress.json   章节 / 字符偏移 / 百分比
├── notes.json      摘录和笔记
└── <id>.txt        正文纯文本
```

想放到别处（例如 `D:\Books`）：

```yaml
- id: dsh-whale-reader
  name: '@local/dsh-whale-reader'
  config:
    dataDir: 'D:/Books'
```

`data/` 默认被 `.gitignore` 排除，避免把个人书库提交到 GitHub。

## 开发

```bash
node --check index.js
node --check client.js
node --check lib/import.mjs
node --check lib/store.mjs
```

目录：

```text
index.js          宿主：工具 + HTTP API
client.js         客户端：设置里的原生阅读面板
lib/store.mjs     本地书库
lib/import.mjs    txt/docx/epub/pdf 解析
docs/DETAIL.md    更详细的行为说明
```

## 隐私

- 不上传书、不调用模型接口
- 所有文件读写都在本机
- HTTP API 只监听 DSH 本地 Web 端口，仅服务原生面板

## License

MIT
