import { Download, KeyRound, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api.js';

const MANUAL_CHECK_COOLDOWN_MS = 30 * 1000;

export function SettingsPanel({ settings, onSettings, t }) {
  const [draft, setDraft] = useState(settings || {});
  const [version, setVersion] = useState(null);
  const [checking, setChecking] = useState(false);
  const [nextManualCheckAt, setNextManualCheckAt] = useState(0);
  const [upgradeProgress, setUpgradeProgress] = useState({ progress: 0, stage: 'idle', status: 'idle', message: '' });

  useEffect(() => setDraft(settings || {}), [settings]);

  useEffect(() => {
    checkVersion('auto');
  }, []);

  async function saveSettings(event) {
    event.preventDefault();
    onSettings(await api('/api/settings', { method: 'PUT', body: draft }));
  }

  async function changePassword(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api('/api/auth/password', {
      method: 'PUT',
      body: {
        currentPassword: form.get('currentPassword'),
        nextPassword: form.get('nextPassword')
      }
    });
    window.location.reload();
  }

  async function checkVersion(mode = 'manual') {
    const now = Date.now();
    if (mode === 'manual' && now < nextManualCheckAt) return;
    setChecking(true);
    try {
      setVersion(await api(`/api/system/version?mode=${mode}`));
      if (mode === 'manual') setNextManualCheckAt(now + MANUAL_CHECK_COOLDOWN_MS);
    } finally {
      setChecking(false);
    }
  }

  async function startUpgrade() {
    const task = await api('/api/system/upgrade', { method: 'POST', body: {} });
    setUpgradeProgress({ progress: 0, stage: 'preparing', status: 'running', message: '' });
    const source = new EventSource(`/api/system/upgrade/${task.taskId}/events`, { withCredentials: true });
    const push = (event) => {
      const data = JSON.parse(event.data);
      setUpgradeProgress({
        progress: data.progress ?? 0,
        stage: data.stage || 'running',
        status: data.status || (data.type === 'done' ? 'completed' : 'running'),
        message: data.message || ''
      });
    };
    ['progress', 'error', 'done'].forEach((type) => source.addEventListener(type, push));
    source.addEventListener('done', () => source.close());
  }

  async function importBackup(file) {
    if (!file) return;
    const text = await file.text();
    await api('/api/backup/import', { method: 'POST', body: JSON.parse(text) });
    window.location.reload();
  }

  return (
    <section className="settings-panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">{t('admin')}</span>
          <h2>{t('settings')}</h2>
        </div>
        <ShieldCheck size={18} />
      </div>
      <div className="settings-grid">
        <form onSubmit={saveSettings} className="settings-card">
          <label>
            {t('language')}
            <select value={draft.language || 'zh-CN'} onChange={(event) => setDraft({ ...draft, language: event.target.value })}>
              <option value="zh-CN">{t('chinese')}</option>
              <option value="en-US">{t('english')}</option>
            </select>
          </label>
          <label>
            {t('tokenLifetime')}
            <input type="number" min={1} max={720} value={draft.tokenTtlHours || 24} onChange={(event) => setDraft({ ...draft, tokenTtlHours: event.target.value })} />
          </label>
          <label>
            {t('githubRepository')}
            <input value={draft.githubRepo || ''} onChange={(event) => setDraft({ ...draft, githubRepo: event.target.value })} placeholder="owner/lumeshell" />
          </label>
          <button type="submit">{t('saveSettings')}</button>
        </form>

        <form onSubmit={changePassword} className="settings-card">
          <h3><KeyRound size={16} /> {t('password')}</h3>
          <input name="currentPassword" type="password" placeholder={t('currentPassword')} />
          <input name="nextPassword" type="password" minLength={8} placeholder={t('newPassword')} />
          <button type="submit">{t('changePassword')}</button>
        </form>

        <div className="settings-card">
          <h3><Download size={16} /> {t('backup')}</h3>
          <a className="button-like" href="/api/backup/export">{t('exportData')}</a>
          <label className="button-like">
            <Upload size={15} />
            {t('importData')}
            <input type="file" accept="application/json" hidden onChange={(event) => importBackup(event.target.files?.[0])} />
          </label>
        </div>

        <div className="settings-card">
          <h3><RefreshCw size={16} /> {t('upgrade')}</h3>
          <button type="button" onClick={() => checkVersion('manual')} disabled={checking || Date.now() < nextManualCheckAt}>
            {checking ? t('checkingVersion') : Date.now() < nextManualCheckAt ? t('checkLater') : t('checkVersion')}
          </button>
          {version && (
            <p>
              {t('local')} {version.remote.localVersion || version.local.version}
              {version.remote.remoteVersion ? ` · ${t('remote')} ${version.remote.remoteVersion}` : ''}
              {version.remote.updateAvailable ? ` · ${t('updateAvailable')}` : ''}
              {version.remote.error ? ` · ${version.remote.error}` : ''}
            </p>
          )}
          <button type="button" onClick={startUpgrade}>{t('runUpgrade')}</button>
          <div className="upgrade-progress">
            <div className="upgrade-progress-label">
              <span>{t('upgradeProgress')}</span>
              <strong>{upgradeProgress.progress}%</strong>
            </div>
            <progress max="100" value={upgradeProgress.progress} />
            <small>{stageLabel(upgradeProgress.stage, t)}</small>
          </div>
        </div>
      </div>
    </section>
  );
}

function stageLabel(stage, t) {
  const map = {
    idle: 'upgradeIdle',
    queued: 'upgradeIdle',
    preparing: 'upgradePreparing',
    fetching: 'upgradeFetching',
    installing: 'upgradeInstalling',
    building: 'upgradeBuilding',
    restarting: 'upgradeRestarting',
    running: 'upgradeRunning',
    completed: 'upgradeCompleted',
    failed: 'upgradeFailed'
  };
  return t(map[stage] || 'upgradeRunning');
}
