export function formatBytes(value = 0) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = Number(value || 0);
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function percent(used, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((used / total) * 100)));
}

export function parentDir(path) {
  if (!path || path === '/') return '/';
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return `/${parts.join('/')}`;
}

export function joinRemote(base, name) {
  return `/${[base, name].join('/').split('/').filter(Boolean).join('/')}`;
}

export function ensureTrailingNewline(value) {
  if (!value) return '';
  return value.endsWith('\n') || value.endsWith('\r') ? value : `${value}\n`;
}

export function decodeBase64ToText(value) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function makeTab(connection, initialCommand = '') {
  return {
    id: `${connection.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    connectionId: connection.id,
    title: connection.name || connection.host,
    connectedAt: new Date().toISOString(),
    initialCommand
  };
}
