import crypto from 'node:crypto';

const HASH_ALGORITHM = 'sha256';
const DEFAULT_ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function randomId(size = 16) {
  return crypto.randomBytes(size).toString('hex');
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex'), iterations = DEFAULT_ITERATIONS) {
  const hash = crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, HASH_ALGORITHM).toString('hex');
  return { hash, salt, iterations };
}

export function verifyPassword(password, record) {
  if (!record?.hash || !record?.salt) return false;
  const candidate = hashPassword(password, record.salt, record.iterations || DEFAULT_ITERATIONS).hash;
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(record.hash, 'hex'));
}

function encryptionKey(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptText(value, secret) {
  if (!value) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptText(payload, secret) {
  if (!payload) return '';
  const [version, ivText, tagText, encryptedText] = String(payload).split(':');
  if (version !== 'v1') throw new Error('Unsupported encrypted payload version');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(secret), Buffer.from(ivText, 'base64'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

export function signToken(payload, secret, ttlSeconds) {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    iat: Math.floor(Date.now() / 1000),
    nonce: randomId(8)
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyToken(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  if (Buffer.byteLength(sig) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
