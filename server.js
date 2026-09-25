'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const allowed = new Set(['index.html', 'style.css', 'engine.js', 'game-store.js', 'app.js', 'ai-worker.js', 'assets/panda.jpg', 'assets/neko.jpg', 'assets/kuma.jpg', 'assets/usagi.jpg', 'assets/inu.jpg', 'assets/hiyoko.jpg']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!allowed.has(file)) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(path.join(__dirname, file), (error, data) => {
    if (error) { res.writeHead(500); res.end('Unable to load file'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-cache' }); res.end(data);
  });
});
server.listen(process.env.PORT || 3000, '127.0.0.1', () => console.log(`Othello: http://localhost:${server.address().port}`));
