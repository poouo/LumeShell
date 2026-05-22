import { Client } from 'ssh2';
import { decryptText, encryptText, randomId } from './crypto.js';
import { store } from './store.js';

export function publicConnection(connection) {
  return {
    id: connection.id,
    name: connection.name,
    host: connection.host,
    port: connection.port,
    username: connection.username,
    authType: connection.authType,
    remoteBase: connection.remoteBase || '/',
    hasPassword: Boolean(connection.password),
    hasPrivateKey: Boolean(connection.privateKey),
    hasPassphrase: Boolean(connection.passphrase),
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt
  };
}

export function listConnections() {
  return store.data.connections.map(publicConnection);
}

export function getConnection(id) {
  return store.data.connections.find((item) => item.id === id);
}

export function upsertConnection(input, id = randomId(8)) {
  const now = new Date().toISOString();
  const existing = getConnection(id);
  const secret = store.getSecret();
  const next = {
    id,
    name: input.name?.trim() || input.host,
    host: input.host?.trim(),
    port: Number(input.port || 22),
    username: input.username?.trim(),
    authType: input.authType || 'password',
    remoteBase: input.remoteBase || '/',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    password: existing?.password || '',
    privateKey: existing?.privateKey || '',
    passphrase: existing?.passphrase || ''
  };

  if (Object.hasOwn(input, 'password')) next.password = encryptText(input.password, secret);
  if (Object.hasOwn(input, 'privateKey')) next.privateKey = encryptText(input.privateKey, secret);
  if (Object.hasOwn(input, 'passphrase')) next.passphrase = encryptText(input.passphrase, secret);

  if (existing) {
    Object.assign(existing, next);
  } else {
    store.data.connections.push(next);
  }
  store.save();
  return publicConnection(next);
}

export function deleteConnection(id) {
  const before = store.data.connections.length;
  store.data.connections = store.data.connections.filter((item) => item.id !== id);
  store.save();
  return store.data.connections.length !== before;
}

export function toSshConfig(connection, overrides = {}) {
  if (!connection) throw new Error('Connection not found');
  const secret = store.getSecret();
  const cfg = {
    host: connection.host,
    port: Number(connection.port || 22),
    username: connection.username,
    readyTimeout: Number(overrides.readyTimeout ?? 15_000),
    keepaliveInterval: Number(overrides.keepaliveInterval ?? 20_000),
    keepaliveCountMax: Number(overrides.keepaliveCountMax ?? 9)
  };
  if (connection.password) cfg.password = decryptText(connection.password, secret);
  if (connection.privateKey) cfg.privateKey = decryptText(connection.privateKey, secret);
  if (connection.passphrase) cfg.passphrase = decryptText(connection.passphrase, secret);
  return cfg;
}

export function isSshConnectionError(err) {
  return Boolean(
    err?.level ||
    /handshake|authentication|connection|timed out|ECONN|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT/i.test(err?.message || '')
  );
}

export function formatSshError(err) {
  if (err?.level === 'client-timeout' || /handshake/i.test(err?.message || '')) {
    return 'SSH handshake timed out. Check the host, port, firewall, or SSH service.';
  }
  if (err?.level === 'client-authentication' || /authentication/i.test(err?.message || '')) {
    return 'SSH authentication failed. Check the username, password, or key.';
  }
  return err?.message || 'SSH connection failed.';
}

export function connectSsh(connection) {
  const client = new Client();
  const config = toSshConfig(connection);
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      client.end();
      reject(err);
    };
    client.once('ready', () => {
      settled = true;
      resolve(client);
    });
    client.once('error', fail);
    try {
      client.connect(config);
    } catch (err) {
      fail(err);
    }
  });
}

export function connectSftp(connection) {
  return connectSsh(connection).then(
    (client) =>
      new Promise((resolve, reject) => {
        client.sftp((err, sftp) => {
          if (err) {
            client.end();
            reject(err);
            return;
          }
          resolve({ client, sftp });
        });
      })
  );
}
