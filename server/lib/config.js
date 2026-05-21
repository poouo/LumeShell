import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.resolve(__dirname, '..', '..');

export const config = {
  env: process.env.NODE_ENV || 'development',
  host: process.env.LUMESHELL_HOST || '0.0.0.0',
  port: Number(process.env.LUMESHELL_PORT || process.env.PORT || 8090),
  dataDir: path.resolve(rootDir, process.env.LUMESHELL_DATA_DIR || 'data'),
  githubRepo: process.env.LUMESHELL_GITHUB_REPO || 'poouo/LumeShell',
  publicUrl: process.env.LUMESHELL_PUBLIC_URL || 'http://localhost:8090',
  adminPassword: process.env.LUMESHELL_ADMIN_PASSWORD || '',
  defaultTokenTtlHours: Number(process.env.LUMESHELL_TOKEN_TTL_HOURS || 24),
  uploadLimit: process.env.LUMESHELL_UPLOAD_LIMIT || '2gb',
  httpsKeyPath: process.env.LUMESHELL_HTTPS_KEY || '',
  httpsCertPath: process.env.LUMESHELL_HTTPS_CERT || '',
  trustProxy: String(process.env.LUMESHELL_TRUST_PROXY || '').toLowerCase() === 'true',
  requireHttps: String(process.env.LUMESHELL_REQUIRE_HTTPS || '').toLowerCase() === 'true',
  secureCookies: String(process.env.LUMESHELL_SECURE_COOKIES || '').toLowerCase() === 'true'
};
