import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { hashPassword, randomId } from './crypto.js';

const storePath = path.join(config.dataDir, 'store.json');
const secretPath = path.join(config.dataDir, 'app-secret.key');
const initialPasswordPath = path.join(config.dataDir, 'initial-admin-password.txt');

function emptyStore() {
  return {
    meta: {
      name: 'LumeShell',
      version: '0.2.1',
      createdAt: new Date().toISOString()
    },
    settings: {
      tokenTtlHours: config.defaultTokenTtlHours,
      githubRepo: config.githubRepo,
      publicUrl: config.publicUrl,
      theme: 'dark',
      language: 'zh-CN'
    },
    security: null,
    connections: [],
    commands: []
  };
}

export class Store {
  constructor() {
    this.data = null;
    this.secret = null;
  }

  init() {
    fs.mkdirSync(config.dataDir, { recursive: true });
    const uploadTmp = path.join(config.dataDir, 'upload-tmp');
    fs.mkdirSync(uploadTmp, { recursive: true });
    const backupsDir = path.join(config.dataDir, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });

    if (!fs.existsSync(secretPath)) {
      fs.writeFileSync(secretPath, randomId(32), { mode: 0o600 });
    }
    this.secret = fs.readFileSync(secretPath, 'utf8').trim();

    if (!fs.existsSync(storePath)) {
      this.data = emptyStore();
      this.bootstrapSecurity();
      this.save();
    } else {
      this.data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      this.data.settings = { ...emptyStore().settings, ...(this.data.settings || {}) };
      this.data.connections ||= [];
      this.data.commands ||= [];
      if (!this.data.security) {
        this.bootstrapSecurity();
        this.save();
      }
    }
  }

  bootstrapSecurity() {
    const password = config.adminPassword || randomId(9);
    const { hash, salt, iterations } = hashPassword(password);
    this.data.security = { passwordHash: hash, passwordSalt: salt, passwordIterations: iterations };
    if (!config.adminPassword) {
      fs.writeFileSync(
        initialPasswordPath,
        `LumeShell initial admin password: ${password}\nChange it after first login.\n`,
        { mode: 0o600 }
      );
    }
  }

  save() {
    const tempPath = `${storePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(this.data, null, 2)}\n`);
    fs.renameSync(tempPath, storePath);
  }

  exportBackup() {
    return {
      format: 'lumeshell-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      appSecret: this.secret,
      store: this.data
    };
  }

  importBackup(backup) {
    if (backup?.format !== 'lumeshell-backup' || backup?.version !== 1 || !backup?.appSecret || !backup?.store) {
      throw new Error('Invalid LumeShell backup file');
    }
    const nextStore = backup.store;
    nextStore.settings = { ...emptyStore().settings, ...(nextStore.settings || {}) };
    nextStore.connections ||= [];
    nextStore.commands ||= [];
    if (!nextStore.security) throw new Error('Backup does not contain security settings');

    const tempStorePath = `${storePath}.import`;
    const tempSecretPath = `${secretPath}.import`;
    fs.writeFileSync(tempStorePath, `${JSON.stringify(nextStore, null, 2)}\n`);
    fs.writeFileSync(tempSecretPath, String(backup.appSecret), { mode: 0o600 });
    fs.renameSync(tempStorePath, storePath);
    fs.renameSync(tempSecretPath, secretPath);
    this.data = nextStore;
    this.secret = String(backup.appSecret);
  }

  getSecret() {
    return this.secret;
  }

  getUploadTmpDir() {
    return path.join(config.dataDir, 'upload-tmp');
  }
}

export const store = new Store();
