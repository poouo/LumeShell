import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { config, rootDir } from './lib/config.js';
import { store } from './lib/store.js';
import { requireWsAuth } from './lib/auth.js';
import { getConnection, toSshConfig } from './lib/connections.js';
import { sendError } from './lib/http.js';
import { authRouter } from './routes/auth.js';
import { commandsRouter } from './routes/commands.js';
import { connectionsRouter } from './routes/connections.js';
import { filesRouter } from './routes/files.js';
import { settingsRouter } from './routes/settings.js';
import { systemRouter } from './routes/system.js';
import { backupRouter } from './routes/backup.js';
import { Client } from 'ssh2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

store.init();

const app = express();
const httpsOptions = config.httpsKeyPath && config.httpsCertPath
  ? {
      key: fs.readFileSync(config.httpsKeyPath),
      cert: fs.readFileSync(config.httpsCertPath)
    }
  : null;
const server = httpsOptions ? https.createServer(httpsOptions, app) : http.createServer(app);

app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (config.requireHttps && !req.secure) {
    res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
    return;
  }
  next();
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, name: 'LumeShell' });
});

app.use('/api/auth', authRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/commands', commandsRouter);
app.use('/api/files', filesRouter);
app.use('/api/system', systemRouter);
app.use('/api/backup', backupRouter);

const distDir = path.join(rootDir, 'client', 'dist');
app.use(express.static(distDir));
app.use((_req, res, next) => {
  const indexPath = path.join(distDir, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) next(err);
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  sendError(res, 500, err.message || 'Internal server error');
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname !== '/ws/terminal') {
    socket.destroy();
    return;
  }
  const user = requireWsAuth(req);
  if (!user) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, url);
  });
});

wss.on('connection', (ws, _req, url) => {
  const connectionId = url.searchParams.get('connectionId');
  const term = url.searchParams.get('term') || 'xterm-256color';
  const cols = Number(url.searchParams.get('cols') || 100);
  const rows = Number(url.searchParams.get('rows') || 30);
  const connection = getConnection(connectionId);

  if (!connection) {
    ws.send(JSON.stringify({ type: 'error', message: 'Connection not found' }));
    ws.close();
    return;
  }

  const client = new Client();
  let stream = null;
  const send = (payload) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
  };

  client.on('ready', () => {
    client.shell({ term, cols, rows }, (err, shell) => {
      if (err) {
        send({ type: 'error', message: err.message });
        ws.close();
        return;
      }
      stream = shell;
      send({ type: 'ready' });
      stream.on('data', (data) => send({ type: 'data', data: data.toString('base64') }));
      stream.stderr?.on('data', (data) => send({ type: 'data', data: data.toString('base64') }));
      stream.on('close', () => ws.close());
    });
  });

  client.on('error', (err) => {
    send({ type: 'error', message: err.message });
    ws.close();
  });

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (message.type === 'input' && stream) {
      stream.write(message.data || '');
    }
    if (message.type === 'resize' && stream) {
      stream.setWindow(Number(message.rows || 30), Number(message.cols || 100));
    }
  });

  ws.on('close', () => {
    stream?.end();
    client.end();
  });

  try {
    client.connect(toSshConfig(connection));
  } catch (err) {
    send({ type: 'error', message: err.message });
    ws.close();
  }
});

server.listen(config.port, config.host, () => {
  const protocol = httpsOptions ? 'https' : 'http';
  console.log(`LumeShell listening on ${protocol}://${config.host}:${config.port}`);
  console.log(`Data directory: ${config.dataDir}`);
});
