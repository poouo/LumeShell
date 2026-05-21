import { Activity, Clock3, Gauge } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { formatBytes, percent } from '../utils.js';

const METRIC_OK_DELAY_MS = 1000;
const METRIC_ERROR_DELAY_MS = 10_000;
const TRAFFIC_WINDOW_SECONDS = 15;
const CHART_WIDTH = 180;
const CHART_HEIGHT = 54;

export function MetricsPanel({ connection, t }) {
  const [samples, setSamples] = useState([]);
  const lastRef = useRef(null);

  useEffect(() => {
    setSamples([]);
    lastRef.current = null;
    if (!connection) return undefined;

    let stopped = false;
    let timer;
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
        timer = window.setTimeout(tick, METRIC_OK_DELAY_MS);
      } catch (err) {
        if (stopped) return;
        timer = window.setTimeout(tick, METRIC_ERROR_DELAY_MS);
      }
    }

    tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [connection?.id]);

  const latest = samples.at(-1);
  const traffic = useMemo(() => {
    const visibleSamples = samples.slice(-TRAFFIC_WINDOW_SECONDS);
    const padded = [
      ...Array(Math.max(0, TRAFFIC_WINDOW_SECONDS - visibleSamples.length)).fill(null),
      ...visibleSamples
    ];
    const max = Math.max(1, ...padded.map((sample) => Math.max(sample?.rxRate || 0, sample?.txRate || 0)));
    const points = padded.map((sample, index) => {
      const x = padded.length <= 1 ? 0 : (index / (padded.length - 1)) * CHART_WIDTH;
      return {
        index,
        x,
        rxY: CHART_HEIGHT - ((sample?.rxRate || 0) / max) * CHART_HEIGHT,
        txY: CHART_HEIGHT - ((sample?.txRate || 0) / max) * CHART_HEIGHT,
        rxRate: sample?.rxRate || 0,
        txRate: sample?.txRate || 0
      };
    });
    return {
      max,
      points,
      rxLine: points.map((point) => `${point.x},${point.rxY}`).join(' '),
      txLine: points.map((point) => `${point.x},${point.txY}`).join(' '),
      labels: [max, max / 2, 0].map((value) => formatBytes(value))
    };
  }, [samples]);

  if (!connection) return <section className="metrics-panel empty-state">{t('openConnectionMetrics')}</section>;

  return (
    <section className="metrics-panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">{t('server')}</span>
          <h2>{connection.name}</h2>
        </div>
        <Activity size={18} />
      </div>
      <>
        <div className="metric-summary">
          <Metric icon={<Clock3 size={15} />} label={t('uptimeDays')} value={formatUptimeDays(latest?.uptimeSeconds)} />
          <Metric icon={<Gauge size={15} />} label={t('load')} value={formatLoad(latest?.load)} />
        </div>
        <div className="usage-list">
          <UsageMeter label={t('cpu')} value={latest?.cpuPercent || 0} />
          <UsageMeter label={t('memory')} value={percent(latest?.memory?.used, latest?.memory?.total)} detail={`${formatBytes(latest?.memory?.used)} / ${formatBytes(latest?.memory?.total)}`} tone="warm" />
          <UsageMeter label={t('swap')} value={percent(latest?.swap?.used, latest?.swap?.total)} detail={`${formatBytes(latest?.swap?.used)} / ${formatBytes(latest?.swap?.total)}`} />
          <UsageMeter label={t('disk')} value={percent(latest?.disk?.used, latest?.disk?.total)} detail={`${formatBytes(latest?.disk?.used)} / ${formatBytes(latest?.disk?.total)}`} />
        </div>
        <div className="traffic-panel">
          <div className="traffic-header">
            <span>{t('trafficLast15s')}</span>
            <div className="traffic-legend">
              <span><i />{t('download')}</span>
              <span><b />{t('upload')}</span>
            </div>
          </div>
          <div className="traffic-line-chart" aria-label={t('trafficLast15s')}>
            <div className="traffic-axis">
              {traffic.labels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
            </div>
            <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" role="img">
              <polyline className="traffic-grid-line" points={`0,0 ${CHART_WIDTH},0`} />
              <polyline className="traffic-grid-line" points={`0,${CHART_HEIGHT * 0.5} ${CHART_WIDTH},${CHART_HEIGHT * 0.5}`} />
              <polyline className="traffic-grid-line" points={`0,${CHART_HEIGHT} ${CHART_WIDTH},${CHART_HEIGHT}`} />
              <polyline className="traffic-line rx" points={traffic.rxLine} />
              <polyline className="traffic-line tx" points={traffic.txLine} />
            </svg>
          </div>
        </div>
      </>
    </section>
  );
}

function Metric({ icon, label, value, sub }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{icon}{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function UsageMeter({ label, value = 0, detail = '', tone = 'cool' }) {
  const clamped = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className={`usage-meter ${tone}`}>
      <span>{label}</span>
      <div className="usage-track">
        <i style={{ width: `${clamped}%` }} />
        <strong>{clamped}%</strong>
        {detail && <small>{detail}</small>}
      </div>
    </div>
  );
}

function formatUptimeDays(seconds = 0) {
  if (!seconds) return '0d';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function formatLoad(load) {
  if (!load) return '0.00';
  return [load.one, load.five, load.fifteen]
    .map((value) => Number(value || 0).toFixed(2))
    .join(' ');
}
