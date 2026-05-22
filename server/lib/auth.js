import { store } from './store.js';
import { signToken, verifyPassword, verifyToken, hashPassword } from './crypto.js';
import { parseCookie, sendError } from './http.js';
import { config } from './config.js';

export const AUTH_COOKIE = 'lumeshell_token';

function securityRecord() {
  const security = store.data.security;
  return {
    hash: security.passwordHash,
    salt: security.passwordSalt,
    iterations: security.passwordIterations
  };
}

export function login(password) {
  if (!verifyPassword(password, securityRecord())) return null;
  const ttlHours = Number(store.data.settings.tokenTtlHours || 24);
  return signToken({ sub: 'admin', role: 'admin' }, store.getSecret(), ttlHours * 3600);
}

export function setAuthCookie(res, token) {
  const ttlHours = Number(store.data.settings.tokenTtlHours || 24);
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    maxAge: ttlHours * 3600 * 1000,
    path: '/'
  });
}

export function clearAuthCookie(res) {
  res.cookie(AUTH_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    expires: new Date(0),
    path: '/'
  });
}

export function readTokenFromRequest(req) {
  const cookies = parseCookie(req.headers.cookie || '');
  if (cookies[AUTH_COOKIE]) return cookies[AUTH_COOKIE];
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return '';
}

export function requireAuth(req, res, next) {
  try {
    const token = readTokenFromRequest(req);
    const payload = verifyToken(token, store.getSecret());
    if (!payload) return sendError(res, 401, 'Authentication required');
    req.user = payload;
    next();
  } catch {
    sendError(res, 401, 'Authentication required');
  }
}

export function requireWsAuth(req) {
  const cookies = parseCookie(req.headers.cookie || '');
  const token = cookies[AUTH_COOKIE] || '';
  return verifyToken(token, store.getSecret());
}

export function changePassword(nextPassword) {
  const { hash, salt, iterations } = hashPassword(nextPassword);
  store.data.security = {
    passwordHash: hash,
    passwordSalt: salt,
    passwordIterations: iterations
  };
  store.save();
  return true;
}
