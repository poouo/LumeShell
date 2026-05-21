import { Plus, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { decodeBase64ToText, ensureTrailingNewline } from '../utils.js';

export function TerminalTabs({ tabs, activeTabId, onActiveTab, onCloseTab, onNewTab, connection, commands }) {
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  return (
    <section className="terminal-card">
      <div className="tab-strip">
        {tabs.map((tab) => (
          <button
            type="button"
            className={`tab-button ${tab.id === activeTabId ? 'active' : ''}`}
            key={tab.id}
            onClick={() => onActiveTab(tab.id)}
          >
            <span>{tab.title}</span>
            <X size={14} onClick={(event) => {
              event.stopPropagation();
              onCloseTab(tab.id);
            }} />
          </button>
        ))}
        {connection && (
          <button className="icon-button" title="Open new tab" type="button" onClick={() => onNewTab(connection)}>
            <Plus size={16} />
          </button>
        )}
      </div>
      {activeTab ? (
        <TerminalSession key={activeTab.id} tab={activeTab} commands={commands} />
      ) : (
        <div className="empty-state">Select a server and open a terminal tab.</div>
      )}
    </section>
  );
}

function TerminalSession({ tab, commands }) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const terminalRef = useRef(null);
  const fitRef = useRef(null);
  const [buffer, setBuffer] = useState('');
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      theme: {
        background: '#0b1220',
        foreground: '#e5eefb',
        cursor: '#fde68a',
        selectionBackground: '#2563eb66'
      }
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(containerRef.current);
    fit.fit();
    terminalRef.current = terminal;
    fitRef.current = fit;

    const { cols, rows } = terminal;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws/terminal?connectionId=${tab.connectionId}&cols=${cols}&rows=${rows}`);
    wsRef.current = socket;

    socket.addEventListener('open', () => setStatus('handshaking'));
    socket.addEventListener('close', () => setStatus('closed'));
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'ready') {
        setStatus('connected');
        if (tab.initialCommand) {
          socket.send(JSON.stringify({ type: 'input', data: ensureTrailingNewline(tab.initialCommand) }));
        }
      }
      if (message.type === 'data') terminal.write(decodeBase64ToText(message.data));
      if (message.type === 'error') {
        terminal.writeln(`\r\n[error] ${message.message}`);
        setStatus('error');
      }
    });

    terminal.onData((data) => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ type: 'input', data })));

    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      socket.close();
      terminal.dispose();
    };
  }, [tab]);

  useEffect(() => {
    function onSend(event) {
      if (event.detail?.tabId === tab.id) sendBuffered(event.detail.command, false);
    }
    window.addEventListener('lumeshell:send', onSend);
    return () => window.removeEventListener('lumeshell:send', onSend);
  }, [tab.id, buffer]);

  function sendBuffered(value = buffer, clear = true) {
    const data = ensureTrailingNewline(value);
    if (!data || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'input', data }));
    if (clear) setBuffer('');
  }

  return (
    <div className="terminal-session">
      <div className="terminal-toolbar">
        <span className={`status-dot ${status}`} />
        <span>{status}</span>
        <div className="command-pills">
          {commands.slice(0, 5).map((item) => (
            <button type="button" key={item.id} title={item.command} onClick={() => sendBuffered(item.command)}>
              {item.title}
            </button>
          ))}
        </div>
      </div>
      <div className="terminal-viewport" ref={containerRef} />
      <div className="buffer-input">
        <input
          value={buffer}
          onChange={(event) => setBuffer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') sendBuffered();
          }}
          placeholder="Buffered input: type here, press Enter or Send once"
        />
        <button type="button" onClick={() => sendBuffered()}>
          <Send size={16} />
          Send
        </button>
      </div>
    </div>
  );
}
