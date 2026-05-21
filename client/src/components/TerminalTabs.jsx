import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { decodeBase64ToText, ensureTrailingNewline } from '../utils.js';

export function TerminalTabs({ tabs, activeTabId, t }) {
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  return (
    <section className="terminal-card">
      {activeTab ? (
        <TerminalSession key={activeTab.id} tab={activeTab} t={t} />
      ) : (
        <div className="empty-state">{t('selectServerTerminal')}</div>
      )}
    </section>
  );
}

function TerminalSession({ tab, t }) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const terminalRef = useRef(null);
  const fitRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const reconnectingRef = useRef(false);
  const queuedInputRef = useRef('');
  const mountedRef = useRef(false);
  const [buffer, setBuffer] = useState('');
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    mountedRef.current = true;
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

    const dataDisposable = terminal.onData((data) => sendOrReconnect(data, false));

    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
      const socket = wsRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
      }
    });
    resizeObserverRef.current = resizeObserver;
    resizeObserver.observe(containerRef.current);

    connectTerminal({ initialCommand: tab.initialCommand });

    const closeSocket = () => wsRef.current?.close(1001, 'page hidden');
    window.addEventListener('pagehide', closeSocket);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('pagehide', closeSocket);
      resizeObserver.disconnect();
      dataDisposable.dispose();
      wsRef.current?.close();
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

  function connectTerminal({ initialCommand = '' } = {}) {
    if (!mountedRef.current || reconnectingRef.current) return;
    const currentSocket = wsRef.current;
    if (currentSocket?.readyState === WebSocket.OPEN || currentSocket?.readyState === WebSocket.CONNECTING) return;

    reconnectingRef.current = true;
    setStatus('connecting');
    const terminal = terminalRef.current;
    const cols = terminal?.cols || 100;
    const rows = terminal?.rows || 30;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws/terminal?connectionId=${tab.connectionId}&cols=${cols}&rows=${rows}`);
    wsRef.current = socket;

    socket.addEventListener('open', () => setStatus('handshaking'));
    socket.addEventListener('close', () => {
      if (wsRef.current === socket) {
        wsRef.current = null;
        setStatus('closed');
      }
      reconnectingRef.current = false;
    });
    socket.addEventListener('error', () => {
      setStatus('error');
      reconnectingRef.current = false;
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'ready') {
        setStatus('connected');
        reconnectingRef.current = false;
        const queuedInput = queuedInputRef.current;
        queuedInputRef.current = '';
        if (initialCommand) socket.send(JSON.stringify({ type: 'input', data: ensureTrailingNewline(initialCommand) }));
        if (queuedInput) socket.send(JSON.stringify({ type: 'input', data: queuedInput }));
      }
      if (message.type === 'data') terminalRef.current?.write(decodeBase64ToText(message.data));
      if (message.type === 'error') {
        terminalRef.current?.writeln(`\r\n[error] ${message.message}`);
        setStatus('error');
      }
    });
  }

  function sendOrReconnect(value, clear = true) {
    const data = clear ? ensureTrailingNewline(value) : value;
    if (!data) return;
    const socket = wsRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'input', data }));
      if (clear) setBuffer('');
      return;
    }
    queuedInputRef.current += data;
    connectTerminal();
    if (clear) setBuffer('');
  }

  function sendBuffered(value = buffer, clear = true) {
    const data = ensureTrailingNewline(value);
    if (!data) return;
    sendOrReconnect(data, clear);
  }

  return (
    <div className="terminal-session">
      <div className="terminal-toolbar">
        <div className="terminal-status">
          <span className={`status-dot ${status}`} />
          <strong>{tab.title}</strong>
          <span>{t(`terminalStatus_${status}`)}</span>
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
          placeholder={t('bufferedInput')}
        />
        <button type="button" onClick={() => sendBuffered()}>
          <Send size={16} />
          {t('send')}
        </button>
      </div>
    </div>
  );
}
