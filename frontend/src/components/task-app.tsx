'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api, type Task } from '@/lib/api';
import type { AccountUser } from '@/lib/session';

function Icon({ name }: { name: 'plus' | 'check' | 'arrow' | 'close' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === 'plus' && <path d="M12 5v14M5 12h14" />}
      {name === 'check' && <path d="m5 12 4 4L19 6" />}
      {name === 'arrow' && <path d="M5 12h14m-5-5 5 5-5 5" />}
      {name === 'close' && <path d="m6 6 12 12M6 18 18 6" />}
    </svg>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
}

export default function TaskApp({ user, onLogout }: { user: AccountUser; onLogout: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const loadController = useRef<AbortController | null>(null);
  const saveLock = useRef(false);
  const completeLocks = useRef(new Set<string>());

  const loadData = useCallback((controller: AbortController) => api.list(controller.signal)
    .then((result) => { if (!controller.signal.aborted) setTasks(result); })
    .catch((error: unknown) => { if (!controller.signal.aborted) setLoadError(errorMessage(error)); })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); }), []);

  async function load() {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true);
    setLoadError(null);
    await loadData(controller);
  }

  useEffect(() => {
    const controller = new AbortController();
    loadController.current = controller;
    void loadData(controller);
    return () => controller.abort();
  }, [loadData]);

  useEffect(() => {
    if (formOpen) titleRef.current?.focus();
  }, [formOpen]);

  function closeForm() {
    setFormOpen(false);
    setFormError(null);
    addButtonRef.current?.focus();
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveLock.current) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { setFormError('Vui lòng nhập tiêu đề công việc.'); return; }
    saveLock.current = true;
    setSaving(true);
    setFormError(null);
    setNotification(null);
    try {
      const created = await api.create(trimmedTitle, description);
      setTasks((current) => [created, ...current]);
      setTitle(''); setDescription(''); closeForm();
      setNotification({ kind: 'success', message: 'Đã thêm công việc mới.' });
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  async function completeTask(id: string) {
    if (completeLocks.current.has(id)) return;
    completeLocks.current.add(id);
    setCompleting(new Set(completeLocks.current));
    setNotification(null);
    try {
      const updated = await api.complete(id);
      setTasks((current) => current.map((task) => task.id === id ? updated : task));
      setNotification({ kind: 'success', message: 'Đã hoàn thành công việc. Thêm một bước tiến!' });
    } catch (error) {
      setNotification({ kind: 'error', message: errorMessage(error) });
    } finally {
      completeLocks.current.delete(id);
      setCompleting(new Set(completeLocks.current));
    }
  }

  const completed = tasks.filter((task) => task.status === 'completed').length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Nhịp — trang chủ">
          <span className="brand-mark"><Icon name="check" /></span>
          <span>nhịp<span className="brand-dot">.</span></span>
        </Link>
        <div className="account-menu"><span className="account-email" title={user.email}>{user.email}</span><button className="button secondary" onClick={onLogout}>Đăng xuất</button></div>
      </header>

      <main>
        <section className="intro" aria-labelledby="page-title">
          <div className="eyebrow"><span /> GỌN VIỆC, NHẸ NGÀY</div>
          <h1 id="page-title">Việc nhỏ hôm nay.<br /><span>Bước tiến ngày mai.</span></h1>
          <p>Ghi lại điều cần làm, tập trung từng việc một.<br className="desktop-break" /> Một nhịp làm việc nhẹ nhàng hơn bắt đầu từ đây.</p>
          <div className="intro-decoration" aria-hidden="true">
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="floating-check"><Icon name="check" /></div>
            <span className="orbit-dot" /><span className="small-star">✦</span>
          </div>
        </section>

        <section className="task-section" aria-labelledby="tasks-heading">
          <div className="section-heading">
            <div><div className="eyebrow muted">KHÔNG GIAN CỦA BẠN</div><h2 id="tasks-heading">Công việc <span className="count-pill">{loading || loadError ? '—' : tasks.length}</span></h2></div>
            <button ref={addButtonRef} className="button primary add-button" onClick={() => { setFormError(null); setFormOpen(true); }} disabled={loading || !!loadError || formOpen} aria-expanded={formOpen} aria-controls="add-task-form">
              <Icon name="plus" /><span>Thêm công việc</span>
            </button>
          </div>

          {!loading && !loadError && tasks.length > 0 && (
            <div className="progress-row">
              <span><strong>{completed}</strong> / {tasks.length} công việc đã hoàn thành</span>
              <div className="progress-track" role="progressbar" aria-label="Tiến độ công việc" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={tasks.length}><span style={{ width: `${completed / tasks.length * 100}%` }} /></div>
            </div>
          )}

          {notification && <div className={`notice ${notification.kind}`} role={notification.kind === 'error' ? 'alert' : 'status'}>
            <span>{notification.message}</span><button className="icon-button" aria-label="Đóng thông báo" onClick={() => setNotification(null)}><Icon name="close" /></button>
          </div>}

          {formOpen && <form id="add-task-form" className="task-form" onSubmit={createTask}>
            <div className="form-heading"><h3>Một việc mới cần làm</h3><button type="button" className="icon-button" aria-label="Đóng form" disabled={saving} onClick={closeForm}><Icon name="close" /></button></div>
            <label htmlFor="task-title">Tiêu đề <span className="required-mark">*</span></label>
            <input ref={titleRef} id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Bạn muốn hoàn thành điều gì?" maxLength={120} required disabled={saving} aria-describedby={formError ? 'form-error' : undefined} />
            <label htmlFor="task-description">Mô tả <span className="optional-label">không bắt buộc</span></label>
            <textarea id="task-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Thêm một vài chi tiết…" maxLength={2000} rows={3} disabled={saving} />
            {formError && <p id="form-error" className="form-error" role="alert">{formError}</p>}
            <div className="form-actions"><button className="button secondary" type="button" disabled={saving} onClick={closeForm}>Hủy</button><button className="button primary" disabled={saving} type="submit">{saving ? 'Đang thêm…' : 'Lưu công việc'}<Icon name="arrow" /></button></div>
          </form>}

          <div aria-busy={loading}>
            {loading && <div className="loading-state" role="status"><span className="spinner" />Đang tải công việc…</div>}
            {!loading && loadError && <div className="state-panel error-panel" role="alert"><span className="state-symbol">!</span><h3>Chưa kết nối được</h3><p>{loadError}</p><button className="button secondary" onClick={() => void load()}>Thử lại<Icon name="arrow" /></button></div>}
            {!loading && !loadError && tasks.length === 0 && <div className="state-panel empty-panel"><div className="empty-art" aria-hidden="true"><span /><span /><span /><i><Icon name="check" /></i></div><h3>Một trang mới, một khởi đầu mới.</h3><p>Chưa có công việc nào. Thêm việc đầu tiên<br />và bắt đầu theo nhịp của bạn.</p><button className="text-button" onClick={() => setFormOpen(true)}>Thêm công việc đầu tiên<Icon name="arrow" /></button></div>}
            {!loading && !loadError && tasks.length > 0 && <ul className="task-list">{tasks.map((task) => (
              <li key={task.id} className={`task-card ${task.status}`}>
                <span className="task-symbol" aria-hidden="true">{task.status === 'completed' ? <Icon name="check" /> : <span />}</span>
                <div className="task-content"><div className="task-meta"><span className={`status-badge ${task.status}`}><span />{task.status === 'pending' ? 'Đang chờ' : 'Đã hoàn thành'}</span><time dateTime={task.created_at}>{new Date(task.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</time></div><h3>{task.title}</h3>{task.description && <p>{task.description}</p>}</div>
                {task.status === 'pending' && <button className="button complete-button" onClick={() => void completeTask(task.id)} disabled={completing.has(task.id)} aria-label={`Hoàn thành: ${task.title}`}><Icon name="check" /><span>{completing.has(task.id) ? 'Đang lưu…' : 'Hoàn thành'}</span></button>}
              </li>
            ))}</ul>}
          </div>
        </section>
      </main>
      <footer className="footer"><span>Ít bộn bề hơn. Nhiều khoảng thở hơn.</span><span className="footer-brand">nhịp<span>✦</span></span></footer>
    </div>
  );
}
