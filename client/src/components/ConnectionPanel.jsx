import { KeyRound, Monitor, Plug, Plus, Save, Trash2, X } from 'lucide-react';
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

export function ConnectionPanel({ open, onClose, connections, activeConnectionId, onSelect, onCreate, onUpdate, onDelete, onOpenTab, t }) {
  const [draft, setDraft] = useState(emptyConnection);
  const [editingId, setEditingId] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (!editorOpen) return;
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
  }, [editorOpen, editingId, connections]);

  if (!open) return null;

  function openCreateModal() {
    setEditingId('');
    setDraft(emptyConnection);
    setEditorOpen(true);
  }

  function openEditModal(id) {
    setEditingId(id);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId('');
    setDraft(emptyConnection);
  }

  function closeAll() {
    closeEditor();
    onClose();
  }

  async function save(event) {
    event.preventDefault();
    const payload = { ...draft };
    if (!payload.password) delete payload.password;
    if (!payload.privateKey) delete payload.privateKey;
    if (!payload.passphrase) delete payload.passphrase;
    if (editingId) await onUpdate(editingId, payload);
    else await onCreate(payload);
    closeEditor();
  }

  async function removeEditing() {
    if (!editingId) return;
    if (!window.confirm(t('deleteConnectionConfirm'))) return;
    await onDelete(editingId);
    closeEditor();
  }

  async function removeConnection(connection, event) {
    event.stopPropagation();
    if (!window.confirm(t('deleteConnectionConfirm'))) return;
    await onDelete(connection.id);
    if (editingId === connection.id) closeEditor();
  }

  function selectAndConnect(connection) {
    onSelect(connection.id);
    onOpenTab(connection);
    closeAll();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) closeAll();
    }}>
      <section className={`server-manager-modal ${editorOpen ? 'editing' : ''}`} role="dialog" aria-modal="true" aria-label={t('serverManager')}>
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{t('servers')}</span>
            <h2>{t('serverManager')}</h2>
          </div>
          <div className="toolbar-actions">
            <button className="icon-button" type="button" title={t('newConnection')} onClick={openCreateModal}>
              <Plus size={18} />
            </button>
            <button className="icon-button" type="button" title="Close" onClick={closeAll}>
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="server-manager-body">
          <div className="server-manager-list">
            {connections.length === 0 && <div className="empty-state">{t('noServers')}</div>}
            {connections.map((connection) => (
              <div key={connection.id} className={`connection-item ${activeConnectionId === connection.id ? 'active' : ''}`}>
                <button type="button" className="connection-select" onClick={() => onSelect(connection.id)}>
                  <Monitor size={18} />
                  <span>
                    <strong>{connection.name}</strong>
                    <small>{connection.username}@{connection.host}:{connection.port}</small>
                  </span>
                </button>
                <div className="connection-row-actions">
                  <button className="icon-button" type="button" title={`${t('edit')} ${connection.name}`} onClick={() => openEditModal(connection.id)}>
                    <KeyRound size={15} />
                  </button>
                  <button className="icon-button" type="button" title={t('connect')} onClick={() => selectAndConnect(connection)}>
                    <Plug size={15} />
                  </button>
                  <button className="icon-button danger" type="button" title={`${t('delete')} ${connection.name}`} onClick={(event) => removeConnection(connection, event)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {editorOpen && (
            <form className="editor-form server-editor" onSubmit={save}>
              <div className="panel-heading compact">
                <div>
                  <span className="eyebrow">{t('servers')}</span>
                  <h2>{editingId ? t('edit') : t('newConnection')}</h2>
                </div>
                <button className="icon-button" type="button" title="Close" onClick={closeEditor}>
                  <X size={16} />
                </button>
              </div>
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
              <div className="form-actions modal-actions">
                <button type="submit">
                  <Save size={16} />
                  {t('save')}
                </button>
                {editingId && (
                  <button className="danger-button" type="button" onClick={removeEditing}>
                    <Trash2 size={16} />
                    {t('delete')}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
