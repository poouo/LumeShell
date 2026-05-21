import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const emptyCommand = { title: '', command: '', connectionId: '', tags: [] };

export function CommandsPanel({ commands, onCreate, onUpdate, onDelete, onRun, t }) {
  const [draft, setDraft] = useState(emptyCommand);
  const [editingId, setEditingId] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [menu, setMenu] = useState(null);

  useEffect(() => {
    if (!editorOpen) return;
    const item = commands.find((command) => command.id === editingId);
    if (item) setDraft({ ...emptyCommand, ...item });
    else setDraft(emptyCommand);
  }, [editorOpen, editingId, commands]);

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

  function openCreate() {
    setEditingId('');
    setDraft(emptyCommand);
    setEditorOpen(true);
  }

  function openEdit(command) {
    setMenu(null);
    setEditingId(command.id);
    setDraft({ ...emptyCommand, ...command });
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId('');
    setDraft(emptyCommand);
  }

  async function save(event) {
    event.preventDefault();
    const payload = {
      ...emptyCommand,
      ...draft,
      title: draft.title.trim(),
      command: draft.command,
      connectionId: ''
    };
    if (editingId) await onUpdate(editingId, payload);
    else await onCreate(payload);
    closeEditor();
  }

  function openContextMenu(event, command) {
    event.preventDefault();
    event.stopPropagation();
    const width = 160;
    const height = 76;
    setMenu({
      command,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8))
    });
  }

  async function removeCommand(command) {
    setMenu(null);
    await onDelete(command.id);
  }

  return (
    <section className="commands-panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">{t('quick')}</span>
          <h2>{t('commands')}</h2>
        </div>
        <button className="icon-button" type="button" title={t('newCommand')} onClick={openCreate}>
          <Plus size={17} />
        </button>
      </div>
      <div className="command-list">
        {commands.map((command) => (
          <div className="command-row" key={command.id} onContextMenu={(event) => openContextMenu(event, command)}>
            <button className="command-trigger" type="button" title={command.title} onClick={() => onRun(command)}>
              <span>{command.title}</span>
            </button>
          </div>
        ))}
      </div>

      {editorOpen && createPortal(
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeEditor();
        }}>
          <form className="command-editor-modal" role="dialog" aria-modal="true" aria-label={editingId ? t('editCommand') : t('newCommand')} onSubmit={save}>
            <div className="panel-heading compact">
              <div>
                <span className="eyebrow">{t('commands')}</span>
                <h2>{editingId ? t('editCommand') : t('newCommand')}</h2>
              </div>
              <button className="icon-button" type="button" title="Close" onClick={closeEditor}>
                <X size={16} />
              </button>
            </div>
            <label>
              {t('commandNote')}
              <input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder={t('commandName')} />
            </label>
            <label>
              {t('commandText')}
              <textarea required value={draft.command} onChange={(event) => setDraft({ ...draft, command: event.target.value })} placeholder="docker ps" rows={5} />
            </label>
            <div className="form-actions modal-actions">
              <button type="submit">
                <Save size={16} />
                {t('save')}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
      {menu && createPortal(
        <div
          className="file-context-menu command-context-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button type="button" className="context-menu-item" onClick={() => openEdit(menu.command)}>
            <Pencil size={15} />
            <span>{t('edit')}</span>
          </button>
          <button type="button" className="context-menu-item danger" onClick={() => removeCommand(menu.command)}>
            <Trash2 size={15} />
            <span>{t('delete')}</span>
          </button>
        </div>,
        document.body
      )}
    </section>
  );
}
