'use strict';
// 红色警戒 联机中转服务器
// 职责：1) 静态托管游戏  2) WebSocket 消息转发（不跑游戏逻辑，房主权威）
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const GAME_FILE = '红色警戒.html';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer(function (req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/healthz') { res.writeHead(200); res.end('ok'); return; }
  if (urlPath === '/' || urlPath === '') urlPath = '/' + GAME_FILE;

  const safe = path.normalize(urlPath).replace(/^([.][.][\\/])+/, '').replace(/^[\\/]+/, '');
  const filePath = path.join(PUBLIC_DIR, safe);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('forbidden'); return; }

  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + safe + '\n把游戏文件放到 public/' + GAME_FILE);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = Object.create(null);
let cidSeq = 1;

function send(ws, obj) {
  if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(obj)); } catch (e) { } }
}

wss.on('connection', function (ws) {
  ws._cid = 'c' + (cidSeq++);
  ws._room = null;
  ws._role = null;
  ws._name = '';
  ws._lastSeen = Date.now();

  ws.on('message', function (raw) {
    ws._lastSeen = Date.now();
    let m;
    try { m = JSON.parse(raw.toString()); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    handle(ws, m);
  });

  ws.on('close', function () {
    const room = ws._room ? rooms[ws._room] : null;
    if (!room) return;
    if (ws._role === 'host') {
      for (const g of Object.values(room.guests)) send(g, { t: 'hostgone' });
      delete rooms[ws._room];
    } else if (ws._role === 'guest') {
      delete room.guests[ws._cid];
      send(room.host, { t: 'leave', cid: ws._cid });
    }
  });

  ws.on('error', function () { try { ws.close(); } catch (e) { } });
});

function handle(ws, m) {
  if (m.t === 'ping') { send(ws, { t: 'pong', ts: m.ts }); return; }

  if (m.t === 'create') {
    const room = String(m.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const name = String(m.name || '').slice(0, 16);
    if (room.length < 4) { send(ws, { t: 'err', msg: '房间码至少4位' }); return; }
    if (rooms[room]) { send(ws, { t: 'err', msg: '房间码已被占用，换一个' }); return; }
    rooms[room] = { host: ws, guests: Object.create(null), created: Date.now() };
    ws._room = room; ws._role = 'host'; ws._name = name;
    send(ws, { t: 'created', room: room, cid: ws._cid });
    console.log('[room] created ' + room + ' by ' + name);
    return;
  }

  if (m.t === 'join') {
    const room = String(m.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const name = String(m.name || '').slice(0, 16);
    const side = m.side | 0;
    const r = rooms[room];
    if (!r) { send(ws, { t: 'err', msg: '房间不存在或房主未创建' }); return; }
    if (Object.keys(r.guests).length >= 3) { send(ws, { t: 'err', msg: '房间已满（最多4人）' }); return; }
    r.guests[ws._cid] = ws;
    ws._room = room; ws._role = 'guest'; ws._name = name;
    send(ws, { t: 'joined', room: room, cid: ws._cid });
    send(r.host, { t: 'joinc', cid: ws._cid, name: name, side: side });
    console.log('[room] ' + name + ' joined ' + room);
    return;
  }

  if (m.t === 'leave') {
    const r = ws._room ? rooms[ws._room] : null;
    if (r && ws._role === 'guest') { delete r.guests[ws._cid]; send(r.host, { t: 'leave', cid: ws._cid }); }
    return;
  }

  const room = ws._room ? rooms[ws._room] : null;
  if (!room) return;

  if (ws._role === 'host') {
    const out = JSON.stringify(m);
    for (const g of Object.values(room.guests)) { if (g.readyState === 1) { try { g.send(out); } catch (e) { } } }
  } else if (ws._role === 'guest') {
    send(room.host, Object.assign({}, m, { cid: ws._cid }));
  }
}

server.listen(PORT, function () { console.log('redalert-server listening on ' + PORT); });

// 心跳剔除：25秒未收到任何消息则断开（页面直接关闭时也能及时通知房主）
setInterval(function () {
  const now = Date.now();
  wss.clients.forEach(function (c) {
    if (c._lastSeen && now - c._lastSeen > 25000) { try { c.terminate(); } catch (e) { } }
  });
}, 10000);
