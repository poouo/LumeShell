import { Download, File, Folder, FolderOpen, FolderPlus, LoaderCircle, RefreshCcw, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, downloadUrl } from '../api.js';
import { formatBytes, joinRemote, parentDir } from '../utils.js';

export function FileManager({ connection, t }) {
  const [path, setPath] = useState(normalizeRemotePath(connection?.remoteBase || '/'));
  const [items, setItems] = useState([]);
  const [cache, setCache] = useState({});
  const [pendingPath, setPendingPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [menu, setMenu] = useState(null);
  const navigationRef = useRef(0);

  useEffect(() => {
    if (!connection) return;
    const basePath = normalizeRemotePath(connection.remoteBase || '/');
    setPath(basePath);
    setItems([]);
    setCache({});
    setPendingPath('');
    setMenu(null);
    loadDirectory(basePath, { activate: true, force: true }).catch(() => {});
  }, [connection?.id]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [menu]);

  async function loadDirectory(targetPath, options = {}) {
    if (!connection) return [];
    const target = normalizeRemotePath(targetPath);
    const { activate = false, force = false } = options;
    const activationId = activate ? ++navigationRef.current : 0;

    if (!force && cache[target]) {
      if (activate) {
        setPath(target);
        setItems(cache[target]);
        setPendingPath('');
        setMenu(null);
      }
      return cache[target];
    }

    if (activate) {
      setPath(target);
      setItems(cache[target] || []);
      setPendingPath(target);
      setMenu(null);
    }
    setLoading(true);
    try {
      const query = new URLSearchParams({ connectionId: connection.id, path: target });
      const nextItems = await api(`/api/files/list?${query}`);
      setCache((current) => ({ ...current, [target]: nextItems }));
      if (activate && activationId === navigationRef.current) {
        setItems(nextItems);
        setPendingPath('');
      }
      return nextItems;
    } finally {
      setLoading(false);
      if (activate && activationId === navigationRef.current) setPendingPath('');
    }
  }

  async function navigateTo(targetPath) {
    setMenu(null);
    await loadDirectory(targetPath, { activate: true });
  }

  async function refresh() {
    setMenu(null);
    await loadDirectory(path, { activate: true, force: true });
  }

  async function mkdir() {
    const name = window.prompt(t('directoryName'));
    if (!name) return;
    await api('/api/files/mkdir', { method: 'POST', body: { connectionId: connection.id, path: joinRemote(path, name) } });
    await refresh();
  }

  async function remove(item) {
    setMenu(null);
    if (!window.confirm(t('deletePathConfirm', { path: item.path }))) return;
    await api('/api/files/delete', { method: 'POST', body: { connectionId: connection.id, path: item.path } });
    await refresh();
  }

  function openContextMenu(event, item) {
    event.preventDefault();
    event.stopPropagation();
    const width = 170;
    const height = item.type === 'directory' ? 132 : 92;
    setMenu({
      item,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8))
    });
  }

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const form = new FormData();
    form.append('connectionId', connection.id);
    form.append('path', path);
    for (const entry of files) {
      const file = entry.file || entry;
      const relativePath = entry.relativePath || file.webkitRelativePath || file.name;
      form.append('files', file, relativePath);
    }
    await api('/api/files/upload', { method: 'POST', body: form });
    await refresh();
  }

  const crumbs = useMemo(() => {
    const parts = path.split('/').filter(Boolean);
    return [{ label: '/', path: '/' }, ...parts.map((part, index) => ({
      label: part,
      path: `/${parts.slice(0, index + 1).join('/')}`
    }))];
  }, [path]);
  const isLoadingCurrent = loading || Boolean(pendingPath);

  if (!connection) return <section className="files-panel empty-state">{t('selectServerFiles')}</section>;

  return (
    <section
      className={`files-panel ${dragging ? 'dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        collectDroppedFiles(event.dataTransfer).then(uploadFiles);
      }}
    >
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">SFTP</span>
          <h2>{t('files')}</h2>
          {isLoadingCurrent && <small className="inline-loading"><LoaderCircle className="spin" size={13} />{t('loadingFiles')}</small>}
        </div>
        <div className="toolbar-actions">
          <label className="icon-button" title={t('uploadFiles')}>
            <Upload size={17} />
            <input type="file" multiple hidden onChange={(event) => uploadFiles(event.target.files)} />
          </label>
          <label className="icon-button" title={t('uploadFolder')}>
            <FolderPlus size={17} />
            <input type="file" multiple webkitdirectory="" hidden onChange={(event) => uploadFiles(event.target.files)} />
          </label>
          <button className="icon-button" type="button" title={t('newDirectory')} onClick={mkdir}>
            <FolderPlus size={17} />
          </button>
          <button className="icon-button" type="button" title={t('refresh')} onClick={refresh}>
            <RefreshCcw size={17} />
          </button>
        </div>
      </div>
      <div className="breadcrumb">
        {crumbs.map((crumb) => (
          <button type="button" key={crumb.path} onClick={() => navigateTo(crumb.path)}>{crumb.label}</button>
        ))}
      </div>
      <div className="file-table">
        {path !== '/' && (
          <div className="file-row">
            <button type="button" className="file-name" onClick={() => navigateTo(parentDir(path))}>
              <Folder size={17} />
              <span>..</span>
            </button>
            <small />
          </div>
        )}
        {isLoadingCurrent && (
          <div className="file-row file-row-status">
            <LoaderCircle className="spin" size={16} />
            <span>{t('loadingFiles')}</span>
            <small />
          </div>
        )}
        {!isLoadingCurrent && items.map((item) => (
          <div className="file-row" key={item.path} onContextMenu={(event) => openContextMenu(event, item)}>
            <button type="button" className="file-name" onClick={() => item.type === 'directory' && navigateTo(item.path)}>
              {item.type === 'directory' ? <Folder size={17} /> : <File size={17} />}
              <span>{item.name}</span>
            </button>
            <small>{item.type === 'directory' ? t('folder') : formatBytes(item.size)}</small>
          </div>
        ))}
        {!isLoadingCurrent && items.length === 0 && <div className="file-empty">{t('emptyDirectory')}</div>}
      </div>
      {dragging && <div className="drop-hint">{t('dropUpload')}</div>}
      {menu && createPortal(
        <div
          className="file-context-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {menu.item.type === 'directory' && (
            <button type="button" className="context-menu-item" onClick={() => navigateTo(menu.item.path)}>
              <FolderOpen size={15} />
              <span>{t('openFolder')}</span>
            </button>
          )}
          <a
            className="context-menu-item"
            href={downloadUrl('/api/files/download', { connectionId: connection.id, path: menu.item.path })}
            onClick={() => setMenu(null)}
          >
            <Download size={15} />
            <span>{t('download')}</span>
          </a>
          <button type="button" className="context-menu-item danger" onClick={() => remove(menu.item)}>
            <Trash2 size={15} />
            <span>{t('delete')}</span>
          </button>
        </div>,
        document.body
      )}
    </section>
  );
}

function normalizeRemotePath(input = '/') {
  let next = String(input || '/').replaceAll('\\', '/');
  if (!next.startsWith('/')) next = `/${next}`;
  next = next.replace(/\/+/g, '/');
  if (next.length > 1) next = next.replace(/\/$/, '');
  return next || '/';
}

async function collectDroppedFiles(dataTransfer) {
  const items = Array.from(dataTransfer.items || []);
  if (!items.length || !items.some((item) => item.webkitGetAsEntry)) {
    return Array.from(dataTransfer.files || []);
  }

  const collected = [];
  await Promise.all(items.map(async (item) => {
    const entry = item.webkitGetAsEntry?.();
    if (entry) await walkEntry(entry, '', collected);
  }));
  return collected;
}

function readEntries(reader) {
  return new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
}

function entryFile(entry) {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function walkEntry(entry, basePath, collected) {
  const relativePath = `${basePath}${entry.name}`;
  if (entry.isFile) {
    const file = await entryFile(entry);
    collected.push({ file, relativePath });
    return;
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    let batch = await readEntries(reader);
    while (batch.length) {
      await Promise.all(batch.map((child) => walkEntry(child, `${relativePath}/`, collected)));
      batch = await readEntries(reader);
    }
  }
}
