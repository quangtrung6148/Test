'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { authApi, readSession, saveSession, type AccountUser, type AuthResult } from '@/lib/session';
import TaskApp from './task-app';

function message(error: unknown) { return error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.'; }

export default function AccountApp() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    let active = true;
    // Confirmation returns here, but requires a fresh password login. Do not
    // trust/store credentials arriving in an email redirect URL fragment.
    const params = new URLSearchParams(window.location.hash.slice(1));
    const redirectNotice = params.has('error_description')
      ? 'Liên kết xác nhận đã hết hạn hoặc không hợp lệ. Vui lòng kiểm tra email.'
      : params.has('access_token') || params.get('type') === 'signup'
        ? 'Email đã được xác nhận. Bạn có thể đăng nhập.' : null;
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    const restore = readSession() ? authApi.me() : Promise.resolve(null);
    restore.then((account) => {
      if (!active) return;
      setUser(account);
      if (redirectNotice) setNotice(redirectNotice);
    }).catch((reason: unknown) => { if (active) setError(message(reason)); })
      .finally(() => { if (active) setChecking(false); });
    const expired = () => { setUser(null); setNotice('Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.'); };
    window.addEventListener('nhip.session-ended', expired);
    return () => { active = false; window.removeEventListener('nhip.session-ended', expired); };
  }, []);

  function accept(result: AuthResult) {
    if (!result.user || !result.session) return false;
    saveSession(result.session);
    setUser(result.user);
    setPassword(''); setConfirmation(''); setError(null); setNotice(null);
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    setError(null); setNotice(null);
    if (mode === 'register' && password !== confirmation) { setError('Mật khẩu nhập lại chưa khớp.'); return; }
    lock.current = true; setBusy(true);
    try {
      const result = mode === 'login'
        ? await authApi.login(email.trim(), password)
        : await authApi.register(email.trim(), password);
      if (!accept(result)) {
        setMode('login'); setPassword(''); setConfirmation('');
        setNotice('Đã gửi yêu cầu đăng ký. Hãy mở email xác nhận rồi đăng nhập.');
      }
    } catch (reason) { setError(message(reason)); }
    finally { lock.current = false; setBusy(false); }
  }

  async function logout() {
    const token = readSession()?.access_token;
    saveSession(null);
    setUser(null); setPassword(''); setConfirmation(''); setError(null);
    setNotice('Bạn đã đăng xuất khỏi thiết bị này.');
    if (token) {
      try { await authApi.logout(token); }
      catch { setNotice('Đã đăng xuất trên thiết bị này. Máy chủ chưa xác nhận việc kết thúc phiên.'); }
    }
  }

  if (checking) return <div className="account-loading" role="status"><span className="spinner" />Đang kiểm tra phiên đăng nhập…</div>;
  if (user) return <TaskApp key={user.id} user={user} onLogout={() => void logout()} />;

  return (
    <div className="app-shell account-shell">
      <header className="topbar"><span className="brand"><span className="brand-mark">✓</span><span>nhịp<span className="brand-dot">.</span></span></span><span className="topbar-note">Không gian công việc của riêng bạn</span></header>
      <main className="account-main">
        <section className="account-intro"><div className="eyebrow"><span /> MỖI NGÀY, MỘT BƯỚC NHỎ</div><h1>Gọn việc.<br /><span>Nhẹ lòng.</span></h1><p>Đăng nhập để lưu công việc của bạn.<br />Mỗi tài khoản có một không gian riêng.</p><div className="account-feature"><span>✓</span> Ghi lại, tập trung và từng bước hoàn thành.</div></section>
        <section className="account-card" aria-labelledby="account-title">
          <div className="account-tabs"><button type="button" className={mode === 'login' ? 'active' : ''} disabled={busy} onClick={() => { setMode('login'); setError(null); setPassword(''); setConfirmation(''); }}>Đăng nhập</button><button type="button" className={mode === 'register' ? 'active' : ''} disabled={busy} onClick={() => { setMode('register'); setError(null); setNotice(null); setPassword(''); }}>Đăng ký</button></div>
          <h2 id="account-title">{mode === 'login' ? 'Chào bạn trở lại' : 'Bắt đầu một nhịp mới'}</h2>
          <p className="account-subtitle">{mode === 'login' ? 'Tiếp tục những việc bạn đang làm.' : 'Tạo tài khoản bằng email và mật khẩu.'}</p>
          {notice && <p className="notice success" role="status">{notice}</p>}
          {error && <p className="notice error" role="alert">{error}</p>}
          <form className="task-form account-form" onSubmit={submit} aria-label={mode === 'login' ? 'Đăng nhập tài khoản' : 'Đăng ký tài khoản'}>
            <label htmlFor="account-email">Email</label><input id="account-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} placeholder="ban@example.com" required disabled={busy} />
            <label htmlFor="account-password">Mật khẩu</label><input id="account-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === 'register' ? 8 : 1} maxLength={128} placeholder={mode === 'register' ? 'Ít nhất 8 ký tự' : 'Nhập mật khẩu của bạn'} required disabled={busy} />
            {mode === 'register' && <><label htmlFor="account-confirmation">Nhập lại mật khẩu</label><input id="account-confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} maxLength={128} required disabled={busy} /></>}
            <button className="button primary account-submit" type="submit" disabled={busy}>{busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
          </form>
          <p className="account-footnote">Công việc của bạn chỉ hiển thị trong tài khoản của bạn.</p>
        </section>
      </main>
    </div>
  );
}
