import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from '../lib/config.js';

const required = [
  'server/index.js',
  'client/src/App.jsx',
  'scripts/install.sh',
  'scripts/upgrade.sh',
  'scripts/uninstall.sh',
  'release.json'
];

let ok = true;
for (const file of required) {
  const exists = fs.existsSync(path.join(rootDir, file));
  console.log(`${exists ? 'ok' : 'missing'} ${file}`);
  ok &&= exists;
}

process.exit(ok ? 0 : 1);
