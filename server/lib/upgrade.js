import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './config.js';
import { randomId } from './crypto.js';
import { store } from './store.js';

const tasks = new Map();

export function readLocalRelease() {
  const releasePath = path.join(rootDir, 'release.json');
  const pkgPath = path.join(rootDir, 'package.json');
  const release = fs.existsSync(releasePath) ? JSON.parse(fs.readFileSync(releasePath, 'utf8')) : {};
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {};
  return {
    version: release.version || pkg.version || '0.0.0',
    name: release.name || pkg.name || 'LumeShell',
    notes: release.notes || []
  };
}

function parseVersion(version) {
  return String(version || '0.0.0')
    .replace(/^v/, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

export function isNewerVersion(remote, local) {
  const a = parseVersion(remote);
  const b = parseVersion(local);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'LumeShell',
      Accept: 'application/json',
      ...headers
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function checkRemoteVersion() {
  const local = readLocalRelease();
  const repo = store.data.settings.githubRepo || 'poouo/LumeShell';
  const result = {
    localVersion: local.version,
    remoteVersion: null,
    updateAvailable: false,
    notes: [],
    repo,
    source: null,
    error: null
  };

  if (!repo) {
    result.error = 'GitHub repository is not configured';
    return result;
  }

  try {
    const latest = await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`);
    result.remoteVersion = String(latest.tag_name || '').replace(/^v/, '');
    result.notes = latest.body ? latest.body.split('\n').filter(Boolean).slice(0, 12) : [];
    result.source = 'release';
  } catch {
    try {
      const branchFile = await fetchJson(`https://raw.githubusercontent.com/${repo}/main/release.json`, {
        Accept: 'application/json'
      });
      result.remoteVersion = branchFile.version;
      result.notes = branchFile.notes || [];
      result.source = 'release.json';
    } catch (err) {
      result.error = `Unable to read remote version: ${err.message}`;
      return result;
    }
  }

  result.updateAvailable = isNewerVersion(result.remoteVersion, result.localVersion);
  return result;
}

export function startUpgradeTask() {
  const id = randomId(8);
  const emitter = new EventEmitter();
  const task = {
    id,
    status: 'running',
    startedAt: new Date().toISOString(),
    events: [],
    emitter
  };
  tasks.set(id, task);

  const script = process.platform === 'win32' ? 'upgrade.ps1' : 'upgrade.sh';
  const scriptPath = path.join(rootDir, 'scripts', script);
  const command = process.platform === 'win32' ? 'powershell.exe' : 'bash';
  const args = process.platform === 'win32'
    ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath]
    : [scriptPath];

  pushEvent(task, 'start', `Starting upgrade with ${script}`);
  const child = spawn(command, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      LUMESHELL_UPGRADE_IN_APP: '1'
    }
  });

  child.stdout.on('data', (chunk) => pushEvent(task, 'log', chunk.toString()));
  child.stderr.on('data', (chunk) => pushEvent(task, 'log', chunk.toString()));
  child.on('error', (err) => {
    task.status = 'failed';
    pushEvent(task, 'error', err.message);
    pushEvent(task, 'done', 'Upgrade failed');
  });
  child.on('close', (code) => {
    task.status = code === 0 ? 'completed' : 'failed';
    pushEvent(task, 'done', code === 0 ? 'Upgrade completed. Restart the service if it is not supervised.' : `Upgrade exited with code ${code}`);
  });

  return task;
}

function pushEvent(task, type, message) {
  const event = {
    type,
    message: String(message).trimEnd(),
    at: new Date().toISOString()
  };
  task.events.push(event);
  task.emitter.emit('event', event);
}

export function getUpgradeTask(id) {
  return tasks.get(id);
}
