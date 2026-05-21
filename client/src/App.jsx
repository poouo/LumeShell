import { Moon, Settings, Sun, TerminalSquare } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { CommandsPanel } from './components/CommandsPanel.jsx';
import { ConnectionPanel } from './components/ConnectionPanel.jsx';
import { FileManager } from './components/FileManager.jsx';
import { Login } from './components/Login.jsx';
import { MetricsPanel } from './components/MetricsPanel.jsx';
import { SettingsPanel } from './components/SettingsPanel.jsx';
import { TerminalTabs } from './components/TerminalTabs.jsx';
import { ensureTrailingNewline, makeTab } from './utils.js';

export default function App() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [settings, setSettings] = useState({ theme: 'dark' });
  const [connections, setConnections] = useState([]);
  const [commands, setCommands] = useState([]);
  const [activeConnectionId, setActiveConnectionId] = useState('');
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState('');
  const [view, setView] = useState('workspace');
  const [error, setError] = useState('');

  const theme = settings.theme || 'dark';
  const activeConnection = useMemo(
    () => connections.find((connection) => connection.id === activeConnectionId) || connections[0],
    [connections, activeConnectionId]
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const me = await api('/api/auth/me');
      setAuthenticated(true);
      setSettings((current) => ({ ...current, ...me.settings }));
      await loadData();
    } catch {
      setAuthenticated(false);
    } finally {
      setReady(true);
    }
  }

  async function loadData() {
    const [connectionList, commandList, nextSettings] = await Promise.all([
      api('/api/connections'),
      api('/api/commands'),
      api('/api/settings')
    ]);
    setConnections(connectionList);
    setCommands(commandList);
    setSettings((current) => ({ ...current, ...nextSettings }));
    if (!activeConnectionId && connectionList[0]) setActiveConnectionId(connectionList[0].id);
  }

  async function login(password) {
    setError('');
    try {
      await api('/api/auth/login', { method: 'POST', body: { password } });
      setAuthenticated(true);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST', body: {} });
    window.location.reload();
  }

  async function createConnection(payload) {
    const item = await api('/api/connections', { method: 'POST', body: payload });
    setConnections((current) => [...current, item]);
    setActiveConnectionId(item.id);
  }

  async function updateConnection(id, payload) {
    const item = await api(`/api/connections/${id}`, { method: 'PUT', body: payload });
    setConnections((current) => current.map((connection) => connection.id === id ? item : connection));
  }

  async function deleteConnection(id) {
    if (!window.confirm('Delete this connection?')) return;
    await api(`/api/connections/${id}`, { method: 'DELETE' });
    setConnections((current) => current.filter((connection) => connection.id !== id));
    setTabs((current) => current.filter((tab) => tab.connectionId !== id));
  }

  function openTab(connection, initialCommand = '') {
    const tab = makeTab(connection, initialCommand);
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    setActiveConnectionId(connection.id);
    setView('workspace');
  }

  function closeTab(id) {
    setTabs((current) => {
      const next = current.filter((tab) => tab.id !== id);
      if (activeTabId === id) setActiveTabId(next[0]?.id || '');
      return next;
    });
  }

  async function createCommand(payload) {
    const item = await api('/api/commands', { method: 'POST', body: payload });
    setCommands((current) => [...current, item]);
  }

  async function updateCommand(id, payload) {
    const item = await api(`/api/commands/${id}`, { method: 'PUT', body: payload });
    setCommands((current) => current.map((command) => command.id === id ? item : command));
  }

  async function deleteCommand(id) {
    await api(`/api/commands/${id}`, { method: 'DELETE' });
    setCommands((current) => current.filter((command) => command.id !== id));
  }

  function runCommand(command) {
    const tab = tabs.find((item) => item.id === activeTabId);
    if (!tab) {
      const target = connections.find((connection) => connection.id === (command.connectionId || activeConnectionId)) || activeConnection;
      if (target) openTab(target, command.command);
      return;
    }
    window.dispatchEvent(new CustomEvent('lumeshell:send', {
      detail: {
        tabId: tab.id,
        command: ensureTrailingNewline(command.command)
      }
    }));
  }

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setSettings((current) => ({ ...current, theme: nextTheme }));
    if (authenticated) {
      api('/api/settings', { method: 'PUT', body: { ...settings, theme: nextTheme } }).catch(() => {});
    }
  }

  if (!ready) return <div className="boot-screen">Loading LumeShell...</div>;

  if (!authenticated) {
    return (
      <>
        <Login onLogin={login} theme={theme} onToggleTheme={toggleTheme} />
        {error && <div className="toast error">{error}</div>}
      </>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup compact">
          <img src="/logo.svg" alt="" />
          <div>
            <strong>LumeShell</strong>
            <small>{window.location.protocol === 'https:' || window.location.hostname === 'localhost' ? 'Encrypted-ready console' : 'Use HTTPS on public networks'}</small>
          </div>
        </div>
        <nav className="segmented">
          <button className={view === 'workspace' ? 'active' : ''} type="button" onClick={() => setView('workspace')}>
            <TerminalSquare size={16} />
            Workspace
          </button>
          <button className={view === 'settings' ? 'active' : ''} type="button" onClick={() => setView('settings')}>
            <Settings size={16} />
            Settings
          </button>
        </nav>
        <div className="topbar-actions">
          <button className="icon-button" type="button" title="Toggle theme" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="ghost-button" type="button" onClick={logout}>Logout</button>
        </div>
      </header>

      {view === 'settings' ? (
        <SettingsPanel settings={settings} onSettings={setSettings} />
      ) : (
        <main className="workspace-layout">
          <ConnectionPanel
            connections={connections}
            activeConnectionId={activeConnection?.id}
            onSelect={setActiveConnectionId}
            onCreate={createConnection}
            onUpdate={updateConnection}
            onDelete={deleteConnection}
            onOpenTab={openTab}
          />
          <div className="main-column">
            <MetricsPanel connection={activeConnection} />
            <TerminalTabs
              tabs={tabs}
              activeTabId={activeTabId}
              onActiveTab={setActiveTabId}
              onCloseTab={closeTab}
              onNewTab={openTab}
              connection={activeConnection}
              commands={commands.filter((command) => !command.connectionId || command.connectionId === activeConnection?.id)}
            />
          </div>
          <div className="right-column">
            <FileManager connection={activeConnection} />
            <CommandsPanel
              commands={commands}
              connections={connections}
              activeConnectionId={activeConnection?.id}
              onCreate={createCommand}
              onUpdate={updateCommand}
              onDelete={deleteCommand}
              onRun={runCommand}
            />
          </div>
        </main>
      )}
    </div>
  );
}
