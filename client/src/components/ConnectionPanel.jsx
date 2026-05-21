import { KeyRound, Monitor, Plug, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const emptyConnection = {
  name: '',
  host: '',
  port: 22,
  username: '',
  authType: 'password',
  password: '',
  privateKey: '',
  passphrase: '',
  remoteBase: '/'
};

export function ConnectionPanel({ connections, activeConnectionId, onSelect, onCreate, onUpdate, onDelete, onOpenTab, t }) {
  const [draft, setDraft] = useState(emptyConnection);
  const [editingId, setEditingId] = useState('');

  useEffect(() => {
    if (!editingId) {
      setDraft(emptyConnection);
      return;
    }
    const item = connections.find((connection) => connection.id === editingId);
    if (!item) return;
    setDraft({
      ...emptyConnection,
      ...item,
      password: '',
      privateKey: '',
      passphrase: ''
    });
  }, [editingId, connections]);

  async function save(event) {
    event.preventDefault();
    const payload = { ...draft };
    if (!payload.password) delete payload.password;
    if (!payload.privateKey) delete payload.privateKey;
    if (!payload.passphrase) delete payload.passphrase;
    if (editingId) await onUpdate(editingId, payload);
    else await onCreate(payload);
    setEditingId('');
    setDraft(emptyConnection);
  }

  return (
    <aside className="side-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{t('servers')}</span>
          <h2>{t('connections')}</h2>
        </div>
        <button className="icon-button" type="button" title={t('newConnection')} onClick={() => setEditingId('')}>
          <Plus size={18} />
        </button>
      </div>

      <div className="connection-list">
        {connections.map((connection) => (
          <button
            type="button"
            key={connection.id}
            className={`connection-item ${activeConnectionId === connection.id ? 'active' : ''}`}
            onClick={() => onSelect(connection.id)}
          >
            <Monitor size={18} />
            <span>
              <strong>{connection.name}</strong>
              <small>{connection.username}@{connection.host}:{connection.port}</small>
            </span>
          </button>
        ))}
      </div>

      <form className="editor-form" onSubmit={save}>
        <div className="form-row split">
          <label>
            {t('name')}
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder={t('production')} />
          </label>
          <label>
            {t('port')}
            <input type="number" value={draft.port} onChange={(event) => setDraft({ ...draft, port: event.target.value })} />
          </label>
        </div>
        <label>
          {t('host')}
          <input required value={draft.host} onChange={(event) => setDraft({ ...draft, host: event.target.value })} placeholder="192.168.1.10" />
        </label>
        <label>
          {t('username')}
          <input required value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} placeholder="root" />
        </label>
        <label>
          {t('auth')}
          <select value={draft.authType} onChange={(event) => setDraft({ ...draft, authType: event.target.value })}>
            <option value="password">{t('password')}</option>
            <option value="privateKey">{t('privateKey')}</option>
          </select>
        </label>
        {draft.authType === 'password' ? (
          <label>
            {t('password')}
            <input type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder={editingId ? t('keepUnchanged') : ''} />
          </label>
        ) : (
          <>
            <label>
              {t('privateKey')}
              <textarea value={draft.privateKey} onChange={(event) => setDraft({ ...draft, privateKey: event.target.value })} placeholder={editingId ? t('keepUnchanged') : '-----BEGIN OPENSSH PRIVATE KEY-----'} rows={5} />
            </label>
            <label>
              {t('keyPassphrase')}
              <input type="password" value={draft.passphrase} onChange={(event) => setDraft({ ...draft, passphrase: event.target.value })} placeholder={t('optional')} />
            </label>
          </>
        )}
        <label>
          {t('defaultPath')}
          <input value={draft.remoteBase} onChange={(event) => setDraft({ ...draft, remoteBase: event.target.value })} />
        </label>
        <div className="form-actions">
          <button type="submit">
            <Save size={16} />
            {t('save')}
          </button>
          {editingId && (
            <button className="danger-button" type="button" onClick={() => onDelete(editingId)}>
              <Trash2 size={16} />
              {t('delete')}
            </button>
          )}
        </div>
      </form>

      <div className="connection-actions">
        {connections.map((connection) => (
          <div key={connection.id} className="mini-action">
            <button type="button" onClick={() => setEditingId(connection.id)}>
              <KeyRound size={15} />
              {t('edit')} {connection.name}
            </button>
            <button type="button" onClick={() => onOpenTab(connection)}>
              <Plug size={15} />
              {t('connect')}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
