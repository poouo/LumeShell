import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import { connectSftp, getConnection } from './connections.js';

const SFTP_IDLE_MS = 60_000;
const sftpSessions = new Map();

function normalizeRemote(input = '/') {
  let next = String(input || '/').replaceAll('\\', '/');
  if (!next.startsWith('/')) next = `/${next}`;
  return path.posix.normalize(next);
}

function remoteJoin(base, name) {
  return normalizeRemote(path.posix.join(base, name));
}

function attrsToItem(parent, item) {
  const longname = item.longname || '';
  const isDirectory = item.attrs?.isDirectory?.() || longname.startsWith('d');
  const isFile = item.attrs?.isFile?.() || longname.startsWith('-');
  return {
    name: item.filename,
    path: remoteJoin(parent, item.filename),
    type: isDirectory ? 'directory' : isFile ? 'file' : 'other',
    size: item.attrs?.size || 0,
    modifiedAt: item.attrs?.mtime ? new Date(item.attrs.mtime * 1000).toISOString() : null,
    permissions: item.attrs?.mode ? item.attrs.mode.toString(8) : ''
  };
}

function forgetSftpSession(connectionId, session) {
  const current = sftpSessions.get(connectionId);
  if (current?.session === session || current === session) sftpSessions.delete(connectionId);
  if (session?.idleTimer) clearTimeout(session.idleTimer);
}

function closeSftpSession(connectionId, session) {
  if (!session || session.closed) return;
  session.closed = true;
  forgetSftpSession(connectionId, session);
  try {
    session.client.end();
  } catch {
    // The underlying SSH client may already be closed by the remote host.
  }
}

function scheduleSftpClose(connectionId, session) {
  if (session.closed || session.active > 0) return;
  if (session.idleTimer) clearTimeout(session.idleTimer);
  session.idleTimer = setTimeout(() => closeSftpSession(connectionId, session), SFTP_IDLE_MS);
  session.idleTimer.unref?.();
}

async function createSftpSession(connectionId) {
  const connection = getConnection(connectionId);
  const { client, sftp } = await connectSftp(connection);
  const session = { client, sftp, active: 0, idleTimer: null, closed: false };
  const markClosed = () => {
    session.closed = true;
    forgetSftpSession(connectionId, session);
  };
  client.on('close', markClosed);
  client.on('end', markClosed);
  client.on('error', markClosed);
  sftp.on?.('close', markClosed);
  sftp.on?.('error', markClosed);
  return session;
}

async function getSftpSession(connectionId) {
  const current = sftpSessions.get(connectionId);
  if (current?.session && !current.session.closed) {
    if (current.session.idleTimer) clearTimeout(current.session.idleTimer);
    return current.session;
  }
  if (current?.promise) return current.promise;

  const promise = createSftpSession(connectionId)
    .then((session) => {
      sftpSessions.set(connectionId, { session });
      return session;
    })
    .catch((err) => {
      if (sftpSessions.get(connectionId)?.promise === promise) sftpSessions.delete(connectionId);
      throw err;
    });
  sftpSessions.set(connectionId, { promise });
  return promise;
}

function isRecoverableSftpError(err) {
  return /closed|ended|econnreset|epipe|no response|channel|socket/i.test(err?.message || err?.code || '');
}

async function withSftp(connectionId, fn, options = {}) {
  const { dedicated = false, retry = false } = options;
  if (dedicated) {
    const connection = getConnection(connectionId);
    const { client, sftp } = await connectSftp(connection);
    try {
      return await fn(sftp);
    } finally {
      client.end();
    }
  }

  const run = async () => {
    const session = await getSftpSession(connectionId);
    session.active += 1;
    if (session.idleTimer) clearTimeout(session.idleTimer);
    try {
      return await fn(session.sftp);
    } catch (err) {
      closeSftpSession(connectionId, session);
      throw err;
    } finally {
      session.active = Math.max(0, session.active - 1);
      scheduleSftpClose(connectionId, session);
    }
  };

  try {
    return await run();
  } catch (err) {
    if (!retry || !isRecoverableSftpError(err)) throw err;
    return run();
  }
}

function sftpCall(sftp, method, ...args) {
  return new Promise((resolve, reject) => {
    sftp[method](...args, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

export async function listRemote(connectionId, dirPath = '/') {
  const target = normalizeRemote(dirPath);
  return withSftp(connectionId, async (sftp) => {
    const list = await sftpCall(sftp, 'readdir', target);
    return list.map((item) => attrsToItem(target, item)).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, { retry: true });
}

export async function mkdirRemote(connectionId, dirPath) {
  const target = normalizeRemote(dirPath);
  return withSftp(connectionId, async (sftp) => {
    await sftpCall(sftp, 'mkdir', target);
    return { path: target };
  });
}

export async function renameRemote(connectionId, from, to) {
  return withSftp(connectionId, async (sftp) => {
    await sftpCall(sftp, 'rename', normalizeRemote(from), normalizeRemote(to));
    return { ok: true };
  });
}

async function statRemote(sftp, target) {
  return sftpCall(sftp, 'stat', normalizeRemote(target));
}

async function removeRecursive(sftp, target) {
  const attrs = await statRemote(sftp, target);
  if (attrs.isDirectory()) {
    const children = await sftpCall(sftp, 'readdir', target);
    for (const child of children) {
      if (child.filename === '.' || child.filename === '..') continue;
      await removeRecursive(sftp, remoteJoin(target, child.filename));
    }
    await sftpCall(sftp, 'rmdir', target);
  } else {
    await sftpCall(sftp, 'unlink', target);
  }
}

export async function deleteRemote(connectionId, targetPath) {
  return withSftp(connectionId, async (sftp) => {
    await removeRecursive(sftp, normalizeRemote(targetPath));
    return { ok: true };
  });
}

async function ensureRemoteDir(sftp, target) {
  const normalized = normalizeRemote(target);
  if (normalized === '/') return;
  const parts = normalized.split('/').filter(Boolean);
  let current = '';
  for (const part of parts) {
    current = `${current}/${part}`;
    try {
      await sftpCall(sftp, 'stat', current);
    } catch {
      await sftpCall(sftp, 'mkdir', current);
    }
  }
}

function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, normalizeRemote(remotePath), (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function uploadRemote(connectionId, targetDir, files) {
  const target = normalizeRemote(targetDir);
  return withSftp(connectionId, async (sftp) => {
    const uploaded = [];
    for (const file of files) {
      const relative = String(file.originalname || file.filename).replaceAll('\\', '/').replace(/^\/+/, '');
      const remotePath = remoteJoin(target, relative);
      await ensureRemoteDir(sftp, path.posix.dirname(remotePath));
      await uploadFile(sftp, file.path, remotePath);
      uploaded.push({ name: relative, path: remotePath, size: file.size });
      fs.rmSync(file.path, { force: true });
    }
    return uploaded;
  });
}

export async function streamDownload(connectionId, remotePath, res) {
  const target = normalizeRemote(remotePath);
  const connection = getConnection(connectionId);
  const { client, sftp } = await connectSftp(connection);
  let responseOwnsConnection = false;
  try {
    const attrs = await statRemote(sftp, target);
    if (attrs.isDirectory()) {
      responseOwnsConnection = true;
      res.on('finish', () => client.end());
      res.on('close', () => client.end());
      const filename = `${path.posix.basename(target) || 'download'}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err) => res.destroy(err));
      archive.pipe(res);
      await appendDirectoryToArchive(sftp, archive, target, path.posix.basename(target) || 'root');
      await archive.finalize();
    } else {
      responseOwnsConnection = true;
      res.on('finish', () => client.end());
      res.on('close', () => client.end());
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', attrs.size);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(path.posix.basename(target))}"`);
      sftp.createReadStream(target).pipe(res);
    }
  } finally {
    if (!responseOwnsConnection) client.end();
  }
}

async function appendDirectoryToArchive(sftp, archive, remoteDir, zipRoot) {
  const children = await sftpCall(sftp, 'readdir', remoteDir);
  for (const child of children) {
    if (child.filename === '.' || child.filename === '..') continue;
    const childPath = remoteJoin(remoteDir, child.filename);
    const archivePath = path.posix.join(zipRoot, child.filename);
    const attrs = await statRemote(sftp, childPath);
    if (attrs.isDirectory()) {
      archive.append('', { name: `${archivePath}/` });
      await appendDirectoryToArchive(sftp, archive, childPath, archivePath);
    } else {
      archive.append(sftp.createReadStream(childPath), { name: archivePath });
    }
  }
}
