import { LockKeyhole, Moon, Sun } from 'lucide-react';

export function Login({ onLogin, theme, onToggleTheme, t }) {
  async function submit(event) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get('password');
    await onLogin(password);
  }

  return (
    <main className="login-screen">
      <section className="login-shell">
        <div className="brand-lockup">
          <img src="/logo.svg" alt="" />
          <div>
            <h1>LumeShell</h1>
            <p>{t('tagline')}</p>
          </div>
        </div>
        <form className="login-card" onSubmit={submit}>
          <div className="login-title">
            <LockKeyhole size={22} />
            <span>{t('adminAccess')}</span>
          </div>
          <input name="password" type="password" autoFocus placeholder={t('adminPassword')} minLength={1} />
          <button type="submit">{t('enterConsole')}</button>
        </form>
        <button className="ghost-button theme-inline" type="button" onClick={onToggleTheme}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {theme === 'dark' ? t('lightMode') : t('darkMode')}
        </button>
      </section>
    </main>
  );
}
