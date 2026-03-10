const express = require('express');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const MarkdownIt = require('markdown-it');
const hljs = require('highlight.js');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const ROOT_DIR = path.resolve(process.env.DOC_ROOT || '/root/.openclaw');
const PASSWORD = process.env.DOCS_PASSWORD || 'djy-docs-2026';
const SITE_NAME = process.env.SITE_NAME || '龙虾管理后台';
const SESSION_COOKIE = 'doc_viewer_session';
const SESSION_TOKEN = crypto.createHash('sha256').update(PASSWORD).digest('hex');
const IGNORE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.turbo', '.cache']);
const SUPPORTED_EXTS = new Set([
  '.md', '.txt', '.json', '.yaml', '.yml',
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.css', '.scss', '.less', '.html', '.htm',
  '.py', '.go', '.java', '.sh', '.bash', '.zsh',
  '.sql', '.toml', '.ini', '.conf', '.env',
  '.xml', '.csv', '.log', '.dockerfile'
]);

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch (_) {}
    }
    return `<pre class="hljs"><code>${escapeHtml(str)}</code></pre>`;
  },
});

app.use(express.urlencoded({ extended: false }));
app.use('/static', express.static(path.join(__dirname, 'static')));

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(/;\s*/).filter(Boolean).forEach(part => {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx)] = decodeURIComponent(part.slice(idx + 1));
  });
  return out;
}

function isAuthed(req) {
  return parseCookies(req)[SESSION_COOKIE] === SESSION_TOKEN;
}

function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'unauthorized' });
  return res.redirect('/login');
}

function safeResolve(rel = '') {
  const normalized = rel.replace(/^\/+/, '');
  const target = path.resolve(ROOT_DIR, normalized);
  if (!target.startsWith(ROOT_DIR)) throw new Error('Path out of bounds');
  return target;
}

function getExt(file) {
  const base = path.basename(file).toLowerCase();
  if (base === 'dockerfile') return '.dockerfile';
  return path.extname(file).toLowerCase();
}

function shouldIncludeFile(name) {
  return SUPPORTED_EXTS.has(getExt(name));
}

function detectLang(file) {
  const ext = getExt(file);
  switch (ext) {
    case '.json': return 'json';
    case '.yaml':
    case '.yml': return 'yaml';
    case '.txt':
    case '.log': return 'plaintext';
    case '.md': return 'markdown';
    case '.js':
    case '.mjs':
    case '.cjs': return 'javascript';
    case '.jsx': return 'jsx';
    case '.ts': return 'typescript';
    case '.tsx': return 'tsx';
    case '.css': return 'css';
    case '.scss': return 'scss';
    case '.less': return 'less';
    case '.html':
    case '.htm':
    case '.xml': return 'xml';
    case '.py': return 'python';
    case '.go': return 'go';
    case '.java': return 'java';
    case '.sh':
    case '.bash':
    case '.zsh': return 'bash';
    case '.sql': return 'sql';
    case '.toml': return 'ini';
    case '.ini':
    case '.conf':
    case '.env': return 'ini';
    case '.csv': return 'plaintext';
    case '.dockerfile': return 'dockerfile';
    default: return 'plaintext';
  }
}

async function walkDocs(dir, base = '') {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const items = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))) {
    if (entry.name.startsWith('.') && entry.name !== '.openclaw') continue;
    if (IGNORE_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const rel = path.posix.join(base, entry.name);
    if (entry.isDirectory()) {
      const children = await walkDocs(abs, rel);
      if (children.length) items.push({ type: 'dir', name: entry.name, path: rel, children });
    } else if (entry.isFile() && shouldIncludeFile(entry.name)) {
      items.push({ type: 'file', name: entry.name, path: rel, ext: getExt(entry.name) });
    }
  }
  return items;
}

function flattenFiles(tree, out = []) {
  for (const item of tree) {
    if (item.type === 'file') out.push(item.path);
    else flattenFiles(item.children, out);
  }
  return out;
}

function hasCurrentDescendant(item, currentPath) {
  if (!currentPath) return false;
  if (item.type === 'file') return item.path === currentPath;
  return item.children.some(child => hasCurrentDescendant(child, currentPath));
}

function iconForExt(ext) {
  switch (ext) {
    case '.md': return '📝';
    case '.txt':
    case '.log': return '📄';
    case '.json':
    case '.yaml':
    case '.yml':
    case '.toml':
    case '.ini':
    case '.conf':
    case '.env': return '⚙️';
    case '.js':
    case '.jsx':
    case '.ts':
    case '.tsx':
    case '.mjs':
    case '.cjs':
    case '.py':
    case '.go':
    case '.java':
    case '.sh':
    case '.bash':
    case '.zsh':
    case '.sql': return '💻';
    case '.css':
    case '.scss':
    case '.less':
    case '.html':
    case '.htm':
    case '.xml': return '🌐';
    default: return '📄';
  }
}

function renderTree(items, currentPath = '') {
  return `<ul>${items.map(item => {
    if (item.type === 'dir') {
      const open = hasCurrentDescendant(item, currentPath) ? ' open' : '';
      return `<li class="dir"><details${open}><summary>${escapeHtml(item.name)}</summary>${renderTree(item.children, currentPath)}</details></li>`;
    }
    const active = item.path === currentPath ? 'active' : '';
    return `<li class="file ${active}"><a href="/?file=${encodeURIComponent(item.path)}"><span class="file-icon">${iconForExt(item.ext)}</span><span>${escapeHtml(item.name)}</span></a></li>`;
  }).join('')}</ul>`;
}

async function searchDocs(query) {
  const tree = await walkDocs(ROOT_DIR);
  const files = flattenFiles(tree);
  const q = query.toLowerCase();
  const results = [];
  for (const rel of files.slice(0, 8000)) {
    try {
      const abs = safeResolve(rel);
      const text = await fsp.readFile(abs, 'utf8');
      const lower = text.toLowerCase();
      const pathHit = rel.toLowerCase().includes(q);
      const idx = lower.indexOf(q);
      if (pathHit || idx >= 0) {
        const snippet = idx >= 0
          ? text.slice(Math.max(0, idx - 60), Math.min(text.length, idx + 180)).replace(/\n+/g, ' ')
          : rel;
        results.push({ path: rel, ext: getExt(rel), snippet });
      }
      if (results.length >= 80) break;
    } catch (_) {}
  }
  return results;
}

function renderRawBlock(raw, file) {
  const lang = detectLang(file);
  let content = escapeHtml(raw);
  if (hljs.getLanguage(lang)) {
    try {
      content = hljs.highlight(raw, { language: lang, ignoreIllegals: true }).value;
    } catch (_) {}
  }
  return `<pre class="hljs raw-view"><code class="language-${lang}">${content}</code></pre>`;
}

function renderDocContent(file, raw) {
  const ext = getExt(file);
  if (ext === '.md') {
    const rendered = md.render(raw);
    const rawBlock = renderRawBlock(raw, file);
    return `
      <section class="doc-panel rendered-panel">
        <div class="panel-title">Markdown 渲染预览</div>
        <div class="markdown-rendered">${rendered}</div>
      </section>
      <details class="source-toggle">
        <summary>查看原生 Markdown 源码</summary>
        ${rawBlock}
      </details>
    `;
  }
  if (ext === '.html' || ext === '.htm') {
    const srcDoc = raw
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');
    return `
      <section class="doc-panel rendered-panel">
        <div class="panel-title">HTML 公众号预览</div>
        <div class="preview-toolbar">
          <button type="button" class="preview-size-btn" data-width="375">375</button>
          <button type="button" class="preview-size-btn" data-width="430">430</button>
          <button type="button" class="preview-size-btn active" data-width="560">560</button>
          <button type="button" class="preview-size-btn" data-width="720">720</button>
          <button type="button" class="preview-size-btn" data-width="100">全宽</button>
        </div>
        <div class="phone-preview-shell">
          <div class="phone-preview-frame wechat-preview-frame" id="wechat-preview-frame">
            <iframe class="html-preview" sandbox="allow-same-origin" srcdoc="${srcDoc}"></iframe>
          </div>
        </div>
      </section>
      <details class="source-toggle">
        <summary>查看 HTML 源码</summary>
        ${renderRawBlock(raw, file)}
      </details>
      <script>
        (function () {
          const frame = document.getElementById('wechat-preview-frame');
          const buttons = Array.from(document.querySelectorAll('.preview-size-btn'));
          const key = 'lobster_html_preview_width';
          const applyWidth = (value) => {
            const width = value === '100' ? '100%' : value + 'px';
            frame.style.width = width;
            buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.width === value));
            try { localStorage.setItem(key, value); } catch (_) {}
          };
          let saved = '560';
          try { saved = localStorage.getItem(key) || '560'; } catch (_) {}
          applyWidth(saved);
          buttons.forEach(btn => btn.addEventListener('click', () => applyWidth(btn.dataset.width)));
        })();
      </script>
    `;
  }
  return `
    <section class="doc-panel rendered-panel">
      <div class="panel-title">源码 / 原始文件内容</div>
      ${renderRawBlock(raw, file)}
    </section>
  `;
}

function layout({ title, body, search = '', currentPath = '', treeHtml = '' }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} - ${escapeHtml(SITE_NAME)}</title>
  <link rel="stylesheet" href="/static/styles.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css" />
</head>
<body>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">🦞 ${escapeHtml(SITE_NAME)}</div>
      <form class="search" method="GET" action="/search">
        <input name="q" placeholder="搜索文件名 / 正文内容" value="${escapeHtml(search)}" />
        <button type="submit">搜索</button>
      </form>
      <div class="meta">
        <div><strong>根目录：</strong>${escapeHtml(ROOT_DIR)}</div>
        <div><strong>类型：</strong>md / txt / json / yaml / js / ts / py / go / java / sh / sql / css / html / toml / ini / conf / env ...</div>
        <div><a href="/logout">退出</a></div>
      </div>
      <nav class="tree">${treeHtml || '<div class="empty">未发现可展示文件</div>'}</nav>
    </aside>
    <main class="content">
      <div class="toolbar">
        <div class="path">${currentPath ? escapeHtml(currentPath) : '请选择左侧文件'}</div>
      </div>
      <div class="doc-body">${body}</div>
    </main>
  </div>
</body>
</html>`;
}

app.get('/login', (req, res) => {
  if (isAuthed(req)) return res.redirect('/');
  res.send(`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>登录 - ${escapeHtml(SITE_NAME)}</title><link rel="stylesheet" href="/static/styles.css" /></head><body class="login-page"><form class="login-card" method="POST" action="/login"><h1>${escapeHtml(SITE_NAME)}</h1><p>云端只读文档入口，支持 Markdown、代码和配置文件查看。</p><input type="password" name="password" placeholder="输入访问密码" autofocus /><button type="submit">进入后台</button></form></body></html>`);
});

app.post('/login', (req, res) => {
  const password = req.body.password || '';
  if (password !== PASSWORD) return res.status(401).send('密码错误');
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(SESSION_TOKEN)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.redirect('/login');
});

app.use(requireAuth);

app.get('/api/tree', async (req, res) => {
  try {
    const tree = await walkDocs(ROOT_DIR);
    res.json({ root: ROOT_DIR, tree });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const tree = await walkDocs(ROOT_DIR);
    const treeHtml = renderTree(tree);
    if (!q) return res.redirect('/');
    const results = await searchDocs(q);
    const body = `<h1>搜索：${escapeHtml(q)}</h1>${results.length ? `<ul class="search-results">${results.map(r => `<li><a href="/?file=${encodeURIComponent(r.path)}">${iconForExt(r.ext)} ${escapeHtml(r.path)}</a><p>${escapeHtml(r.snippet)}</p></li>`).join('')}</ul>` : '<p>未找到结果</p>'}`;
    res.send(layout({ title: `搜索 ${q}`, body, search: q, treeHtml }));
  } catch (error) {
    res.status(500).send(layout({ title: '错误', body: `<h1>搜索失败</h1><pre>${escapeHtml(error.message)}</pre>` }));
  }
});

app.get('/', async (req, res) => {
  try {
    const tree = await walkDocs(ROOT_DIR);
    const file = String(req.query.file || '').trim();
    const treeHtml = renderTree(tree, file);
    if (!file) {
      const body = `
        <h1>${escapeHtml(SITE_NAME)} 已就绪</h1>
        <p>左侧文件树默认折叠。当前支持：</p>
        <ul>
          <li>Markdown 渲染预览</li>
          <li>原生 Markdown 源码折叠查看</li>
          <li>常见代码文件查看与语法高亮</li>
          <li>常见配置文件查看</li>
          <li>文件名与正文搜索</li>
        </ul>
      `;
      return res.send(layout({ title: SITE_NAME, body, treeHtml }));
    }
    const abs = safeResolve(file);
    const raw = await fsp.readFile(abs, 'utf8');
    const body = renderDocContent(file, raw);
    res.send(layout({ title: file, body, currentPath: file, treeHtml }));
  } catch (error) {
    res.status(500).send(layout({ title: '错误', body: `<h1>读取失败</h1><pre>${escapeHtml(error.message)}</pre>` }));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Doc viewer running on http://0.0.0.0:${PORT}`);
  console.log(`Root directory: ${ROOT_DIR}`);
  console.log(`Site name: ${SITE_NAME}`);
});
