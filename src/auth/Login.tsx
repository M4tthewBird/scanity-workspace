import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Logo } from '../components/Logo';
import { supabase } from '../lib/supabase';

const MIN_PASSWORD_LENGTH = 8;

interface PasswordFieldProps {
  label: string;
  autoComplete: string;
  autoFocus?: boolean;
  value: string;
  onChange: (value: string) => void;
}

function PasswordField({ label, autoComplete, autoFocus, value, onChange }: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={visible ? 'Skrýt heslo' : 'Zobrazit heslo'}
          title={visible ? 'Skrýt heslo' : 'Zobrazit heslo'}
          aria-pressed={visible}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisible(!visible)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M4 4l16 16" />}
          </svg>
        </button>
      </div>
    </div>
  );
}

export function Login({ linkFailed }: { linkFailed: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(linkFailed ? 'Odkaz z e-mailu je neplatný nebo vypršel. Požádejte o nový.' : '');
  const [info, setInfo] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(
        signInError.status === 400 ? 'Nesprávný e-mail nebo heslo.' : 'Přihlášení se nepovedlo. Zkuste to znovu.',
      );
    }
    setBusy(false);
  };

  const resetPassword = async () => {
    if (!email) {
      setError('Nejdřív vyplňte e-mail.');
      return;
    }
    setBusy(true);
    setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname,
    });
    if (resetError) setError('E-mail se nepodařilo odeslat. Zkuste to později.');
    else setInfo('Pokud účet existuje, poslali jsme odkaz pro nastavení hesla.');
    setBusy(false);
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <Logo />
        <h1>Přihlášení</h1>
        <label className="field">
          <span>E-mail</span>
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <PasswordField label="Heslo" autoComplete="current-password" value={password} onChange={setPassword} />
        {error && <p className="form-error" role="alert">{error}</p>}
        {info && <p className="form-info" role="status">{info}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Přihlašuji…' : 'Přihlásit se'}</button>
        <button type="button" className="btn-link" disabled={busy} onClick={resetPassword}>Zapomenuté heslo</button>
      </form>
    </div>
  );
}

export function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Heslo musí mít aspoň ${MIN_PASSWORD_LENGTH} znaků.`);
      return;
    }
    setBusy(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) setError('Heslo se nepodařilo uložit. Zkuste jiné.');
    else onDone();
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <Logo />
        <h1>Nastavte si heslo</h1>
        <PasswordField label="Nové heslo" autoComplete="new-password" autoFocus value={password} onChange={setPassword} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Ukládám…' : 'Uložit heslo'}</button>
      </form>
    </div>
  );
}
