import { Plus, Save, TerminalSquare, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const emptyCommand = { title: '', command: '', connectionId: '', tags: [] };

export function CommandsPanel({ commands, connections, activeConnectionId, onCreate, onUpdate, onDelete, onRun, t }) {
  const [draft, setDraft] = useState(emptyCommand);
  const [editingId, setEditingId] = useState('');

  useEffect(() => {
    const item = commands.find((command) => command.id === editingId);
    if (item) setDraft(item);
    else setDraft({ ...emptyCommand, connectionId: activeConnectionId || '' });
  }, [editingId, commands, activeConnectionId]);

  async function save(event) {
    event.preventDefault();
    if (editingId) await onUpdate(editingId, draft);
    else await onCreate(draft);
    setEditingId('');
    setDraft({ ...emptyCommand, connectionId: activeConnectionId || '' });
  }

  return (
    <section className="commands-panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">{t('quick')}</span>
          <h2>{t('commands')}</h2>
        </div>
        <button className="icon-button" type="button" title={t('newCommand')} onClick={() => setEditingId('')}>
          <Plus size={17} />
        </button>
      </div>
      <form className="command-form" onSubmit={save}>
        <input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder={t('commandName')} />
        <textarea required value={draft.command} onChange={(event) => setDraft({ ...draft, command: event.target.value })} placeholder="docker ps" rows={3} />
        <select value={draft.connectionId || ''} onChange={(event) => setDraft({ ...draft, connectionId: event.target.value })}>
          <option value="">{t('allServers')}</option>
          {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
        </select>
        <button type="submit">
          <Save size={15} />
          {t('save')}
        </button>
      </form>
      <div className="command-list">
        {commands.map((command) => (
          <div className="command-row" key={command.id}>
            <button type="button" onClick={() => onRun(command)}>
              <TerminalSquare size={16} />
              <span>{command.title}</span>
            </button>
            <code>{command.command}</code>
            <div>
              <button className="icon-button" type="button" onClick={() => setEditingId(command.id)}>
                <Save size={14} />
              </button>
              <button className="icon-button danger" type="button" onClick={() => onDelete(command.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
