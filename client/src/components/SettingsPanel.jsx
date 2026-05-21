import { Download, KeyRound, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api.js';

export function SettingsPanel({ settings, onSettings }) {
  const [draft, setDraft] = useState(settings || {});
  const [version, setVersion] = useState(null);
  const [upgradeLog, setUpgradeLog] = useState([]);

  useEffect(() => setDraft(settings || {}), [settings]);

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

  async function checkVersion() {
    setVersion(await api('/api/system/version'));
  }

  async function startUpgrade() {
    const task = await api('/api/system/upgrade', { method: 'POST', body: {} });
    setUpgradeLog([]);
    const source = new EventSource(`/api/system/upgrade/${task.taskId}/events`, { withCredentials: true });
    const push = (event) => setUpgradeLog((current) => [...current, JSON.parse(event.data)]);
    ['start', 'log', 'error', 'done'].forEach((type) => source.addEventListener(type, push));
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
          <span className="eyebrow">Admin</span>
          <h2>Settings</h2>
        </div>
        <ShieldCheck size={18} />
      </div>
      <div className="settings-grid">
        <form onSubmit={saveSettings} className="settings-card">
          <label>
            Token lifetime hours
            <input type="number" min={1} max={720} value={draft.tokenTtlHours || 24} onChange={(event) => setDraft({ ...draft, tokenTtlHours: event.target.value })} />
          </label>
          <label>
            GitHub repository
            <input value={draft.githubRepo || ''} onChange={(event) => setDraft({ ...draft, githubRepo: event.target.value })} placeholder="owner/lumeshell" />
          </label>
          <button type="submit">Save Settings</button>
        </form>

        <form onSubmit={changePassword} className="settings-card">
          <h3><KeyRound size={16} /> Password</h3>
          <input name="currentPassword" type="password" placeholder="Current password" />
          <input name="nextPassword" type="password" minLength={8} placeholder="New password" />
          <button type="submit">Change Password</button>
        </form>

        <div className="settings-card">
          <h3><Download size={16} /> Backup</h3>
          <a className="button-like" href="/api/backup/export">Export Data</a>
          <label className="button-like">
            <Upload size={15} />
            Import Data
            <input type="file" accept="application/json" hidden onChange={(event) => importBackup(event.target.files?.[0])} />
          </label>
        </div>

        <div className="settings-card">
          <h3><RefreshCw size={16} /> Upgrade</h3>
          <button type="button" onClick={checkVersion}>Check Version</button>
          {version && (
            <p>
              Local {version.remote.localVersion || version.local.version}
              {version.remote.remoteVersion ? ` · Remote ${version.remote.remoteVersion}` : ''}
              {version.remote.updateAvailable ? ' · Update available' : ''}
              {version.remote.error ? ` · ${version.remote.error}` : ''}
            </p>
          )}
          <button type="button" onClick={startUpgrade}>Run Upgrade</button>
          <pre className="upgrade-log">{upgradeLog.map((item) => item.message).filter(Boolean).join('\n')}</pre>
        </div>
      </div>
    </section>
  );
}
