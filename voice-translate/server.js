// Zero-dependency server: static files + /api/translate.
// Provider: Claude if ANTHROPIC_API_KEY is set, otherwise the free MyMemory API.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

async function translateClaude(text, from, to) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-haiku-5-5',
      max_tokens: 1024,
      system: 'You are a live interpreter. Translate the user message faithfully and naturally. Output ONLY the translation, no notes or quotes.',
      messages: [{ role: 'user', content: `Translate from ${from} to ${to}:\n\n${text}` }],
    }),
  });
  if (!r.ok) throw new Error(`Claude API ${r.status}`);
  const j = await r.json();
  return j.content.map(c => c.text || '').join('').trim();
}

async function translateMyMemory(text, from, to) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`MyMemory ${r.status}`);
  const j = await r.json();
  return j.responseData.translatedText;
}

async function translate(text, from, to) {
  if (from.split('-')[0] === to.split('-')[0]) return text;
  if (process.env.MOCK_TRANSLATE) return `[${to}] ${text}`; // for tests
  return process.env.ANTHROPIC_API_KEY ? translateClaude(text, from, to) : translateMyMemory(text, from.split('-')[0], to.split('-')[0]);
}

function readBody(req) {
  return new Promise((res, rej) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 1e5) req.destroy(); });
    req.on('end', () => res(b));
    req.on('error', rej);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/translate') {
      const { text, from, to } = JSON.parse(await readBody(req));
      if (!text || !from || !to) { res.writeHead(400); return res.end('{"error":"text, from, to required"}'); }
      const translation = await translate(String(text).slice(0, 4000), from, to);
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ translation }));
    }
    if (req.method === 'GET') {
      const p = req.url.split('?')[0];
      const file = path.normalize(path.join(PUBLIC, p === '/' ? 'index.html' : p));
      if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      return fs.createReadStream(file).pipe(res);
    }
    res.writeHead(405); res.end();
  } catch (e) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

if (require.main === module) server.listen(PORT, () => console.log(`Voice Translate on http://localhost:${PORT}  (provider: ${process.env.ANTHROPIC_API_KEY ? 'Claude' : 'MyMemory'})`));
module.exports = server;
