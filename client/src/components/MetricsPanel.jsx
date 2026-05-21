import { Activity, Cpu, HardDrive, MemoryStick, Network } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { formatBytes, percent } from '../utils.js';

export function MetricsPanel({ connection }) {
  const [samples, setSamples] = useState([]);
  const lastRef = useRef(null);

  useEffect(() => {
    setSamples([]);
    lastRef.current = null;
    if (!connection) return undefined;

    let stopped = false;
    async function tick() {
      try {
        const data = await api(`/api/system/metrics?${new URLSearchParams({ connectionId: connection.id })}`);
        if (stopped) return;
        const previous = lastRef.current;
        const elapsed = previous ? (new Date(data.sampledAt) - new Date(previous.sampledAt)) / 1000 : 1;
        const cpuDelta = previous ? data.cpu.total - previous.cpu.total : 0;
        const idleDelta = previous ? data.cpu.idle - previous.cpu.idle : 0;
        const rxDelta = previous ? data.network.rxBytes - previous.network.rxBytes : 0;
        const txDelta = previous ? data.network.txBytes - previous.network.txBytes : 0;
        const sample = {
          ...data,
          cpuPercent: cpuDelta > 0 ? Math.round(((cpuDelta - idleDelta) / cpuDelta) * 100) : 0,
          rxRate: Math.max(0, rxDelta / Math.max(1, elapsed)),
          txRate: Math.max(0, txDelta / Math.max(1, elapsed))
        };
        lastRef.current = data;
        setSamples((current) => [...current, sample].slice(-15));
      } catch (err) {
        setSamples((current) => current.length ? current : [{ error: err.message, sampledAt: new Date().toISOString() }]);
      }
    }

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [connection?.id]);

  const latest = samples.at(-1);
  const graph = useMemo(() => {
    const max = Math.max(1, ...samples.map((sample) => Math.max(sample.rxRate || 0, sample.txRate || 0)));
    return samples.map((sample, index) => ({
      index,
      rx: ((sample.rxRate || 0) / max) * 100,
      tx: ((sample.txRate || 0) / max) * 100
    }));
  }, [samples]);

  if (!connection) return <section className="metrics-panel empty-state">Open a connection to view server metrics.</section>;

  return (
    <section className="metrics-panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Server</span>
          <h2>{latest?.hostname || connection.name}</h2>
        </div>
        <Activity size={18} />
      </div>
      {latest?.error ? (
        <div className="metric-error">{latest.error}</div>
      ) : (
        <>
          <div className="metric-grid">
            <Metric icon={<Cpu size={17} />} label="CPU" value={`${latest?.cpuPercent || 0}%`} />
            <Metric icon={<MemoryStick size={17} />} label="Memory" value={`${percent(latest?.memory?.used, latest?.memory?.total)}%`} sub={`${formatBytes(latest?.memory?.used)} / ${formatBytes(latest?.memory?.total)}`} />
            <Metric icon={<HardDrive size={17} />} label="Disk" value={`${percent(latest?.disk?.used, latest?.disk?.total)}%`} sub={`${formatBytes(latest?.disk?.used)} / ${formatBytes(latest?.disk?.total)}`} />
            <Metric icon={<Network size={17} />} label="Network" value={`↓ ${formatBytes(latest?.rxRate)}/s`} sub={`↑ ${formatBytes(latest?.txRate)}/s`} />
          </div>
          <div className="traffic-chart" aria-label="Network traffic over the last 15 seconds">
            {graph.map((bar) => (
              <span key={bar.index}>
                <i style={{ height: `${bar.rx}%` }} />
                <b style={{ height: `${bar.tx}%` }} />
              </span>
            ))}
          </div>
          <p className="system-note">{latest?.kernel || 'Sampling every second'} {latest?.uptime ? `· ${latest.uptime}` : ''}</p>
        </>
      )}
    </section>
  );
}

function Metric({ icon, label, value, sub }) {
  return (
    <div className="metric-card">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}
