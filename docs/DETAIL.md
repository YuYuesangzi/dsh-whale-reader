# 源阅书架

把书放在本地文件里，DSH 的 agent 和阅读页面共用同一份书库、进度和笔记。

## 数据

默认目录：插件目录下的 `data/`。

```text
data/
├── index.json      书籍元数据 + 章节字符区间
├── progress.json   每本书的章节 / 字符偏移 / 百分比
├── notes.json      摘录和笔记
└── <id>.txt        正文纯文本
```

可以在配置里把 `dataDir` 指向别的目录，例如 `D:/Books`：

```yaml
- id: dsh-whale-reader
  name: '@local/dsh-whale-reader'
  config:
    dataDir: 'D:/Books'
```

## Agent 工具

- `reader_list_books`：书单和进度
- `reader_search`：全文检索，返回书 id、章节、字符偏移和片段
- `reader_read`：按章读取，支持 `offset` / `limit` 分段；自动写进度
- `reader_progress`：查看全部进度，或保存某本书的章节/偏移/百分比
- `reader_import`：导入本地 txt / docx / epub / pdf
- `reader_notes`：列笔记；给 `excerpt` 或 `note` 时新增

## 入口

设置左侧导航新增「源阅书架」，点开后是 DSH 里的原生 React 面板，不经过独立网页，也不是 iframe。

如果没有看到这一项，刷新一次 DSH 页面；客户端插件在页面启动时注册。

页面提供书架、全文搜索、目录、上一页/下一页和进度条。页面滚动时保存的字符偏移与 agent 的 `reader_read` / `reader_progress` 是同一份数据。

## 导入

页面右上角「＋」可以选择 txt / md / docx / epub / pdf，也可以直接把文件拖进页面；导入后立即出现在书架里。

agent 侧仍然可以用 `reader_import` 导入本地路径。

- TXT / Markdown：自动识别 UTF-8、UTF-16、GB18030
- DOCX：mammoth 提取正文，读 core.xml 的标题和作者
- EPUB：先读 OPF 指向的 `toc.ncx` 或 `nav.xhtml`，用其中的 `#fragment` 定位点切章；没有可用定位点时才退回按标题/字数切分
- PDF：pdf.js 提取每页文字，按页分章
- 旧版 `.doc` 暂不支持，请先另存为 `.docx`

## 限制

- 正文存成纯文本，不保留排版、图片和脚注结构
- 章节按标题正则或字数和分段，复杂排版可能需要手动调整
- 页面不做多用户隔离；它读写的是本机同一份数据
- 搜索是逐本全文扫描，大书库会慢一些
