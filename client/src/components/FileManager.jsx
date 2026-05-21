import { Download, File, Folder, FolderPlus, RefreshCcw, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, downloadUrl } from '../api.js';
import { formatBytes, joinRemote, parentDir } from '../utils.js';

export function FileManager({ connection, t }) {
  const [path, setPath] = useState(connection?.remoteBase || '/');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setPath(connection?.remoteBase || '/');
  }, [connection?.id]);

  useEffect(() => {
    if (connection) refresh();
  }, [connection?.id, path]);

  async function refresh() {
    if (!connection) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({ connectionId: connection.id, path });
      setItems(await api(`/api/files/list?${query}`));
    } finally {
      setLoading(false);
    }
  }

  async function mkdir() {
    const name = window.prompt(t('directoryName'));
    if (!name) return;
    await api('/api/files/mkdir', { method: 'POST', body: { connectionId: connection.id, path: joinRemote(path, name) } });
    await refresh();
  }

  async function remove(item) {
    if (!window.confirm(t('deletePathConfirm', { path: item.path }))) return;
    await api('/api/files/delete', { method: 'POST', body: { connectionId: connection.id, path: item.path } });
    await refresh();
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
          <button type="button" key={crumb.path} onClick={() => setPath(crumb.path)}>{crumb.label}</button>
        ))}
      </div>
      <div className="file-table">
        {path !== '/' && (
          <button className="file-row" type="button" onClick={() => setPath(parentDir(path))}>
            <Folder size={17} />
            <span>..</span>
            <small />
            <small />
          </button>
        )}
        {items.map((item) => (
          <div className="file-row" key={item.path}>
            <button type="button" className="file-name" onClick={() => item.type === 'directory' && setPath(item.path)}>
              {item.type === 'directory' ? <Folder size={17} /> : <File size={17} />}
              <span>{item.name}</span>
            </button>
            <small>{item.type === 'directory' ? t('folder') : formatBytes(item.size)}</small>
            <small>{item.modifiedAt ? new Date(item.modifiedAt).toLocaleString() : ''}</small>
            <span className="row-actions">
              <a className="icon-button" title={t('download')} href={downloadUrl('/api/files/download', { connectionId: connection.id, path: item.path })}>
                <Download size={15} />
              </a>
              <button className="icon-button danger" type="button" title={t('delete')} onClick={() => remove(item)}>
                <Trash2 size={15} />
              </button>
            </span>
          </div>
        ))}
      </div>
      {loading && <div className="drop-hint">{t('loadingFiles')}</div>}
      {dragging && <div className="drop-hint">{t('dropUpload')}</div>}
    </section>
  );
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
