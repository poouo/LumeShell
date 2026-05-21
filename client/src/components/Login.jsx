import { LockKeyhole, Moon, Sun } from 'lucide-react';

export function Login({ onLogin, theme, onToggleTheme }) {
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
            <p>Personal WebSSH workspace</p>
          </div>
        </div>
        <form className="login-card" onSubmit={submit}>
          <div className="login-title">
            <LockKeyhole size={22} />
            <span>Admin access</span>
          </div>
          <input name="password" type="password" autoFocus placeholder="Admin password" minLength={1} />
          <button type="submit">Enter Console</button>
        </form>
        <button className="ghost-button theme-inline" type="button" onClick={onToggleTheme}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </section>
    </main>
  );
}
