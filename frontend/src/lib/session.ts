export interface AccountUser { id: string; email: string; }
export interface AccountSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}
export interface AuthResult {
  user: AccountUser | null;
  session: AccountSession | null;
  confirmation_required: boolean;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const storageKey = 'nhip.account-session';
const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000').replace(/\/+$/, '');
let session: AccountSession | null | undefined;
let refreshInFlight: Promise<AccountSession> | null = null;
let sessionVersion = 0;

export function readSession(): AccountSession | null {
  if (session !== undefined) return session;
  session = null;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<AccountSession>;
    if (typeof value.access_token === 'string' && typeof value.refresh_token === 'string'
      && typeof value.expires_at === 'number' && Number.isFinite(value.expires_at)) {
      session = value as AccountSession;
    }
  } catch { /* Storage unavailable: session stays in memory for this tab. */ }
  return session;
}

export function saveSession(value: AccountSession | null, refreshed = false) {
  if (!refreshed) sessionVersion++;
  session = value;
  if (typeof window === 'undefined') return;
  try {
    if (value) window.sessionStorage.setItem(storageKey, JSON.stringify(value));
    else window.sessionStorage.removeItem(storageKey);
  } catch { /* A blocked browser storage does not prevent in-memory login. */ }
  if (!value) window.dispatchEvent(new Event('nhip.session-ended'));
}

export async function rawRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v1${path}`, {
      ...options, cache: 'no-store',
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError('Không thể kết nối máy chủ. Vui lòng thử lại.', 503);
  }
  let payload: { data?: T; error?: { message?: string } } | null;
  try { payload = await response.json(); }
  catch { throw new ApiError('Máy chủ trả về dữ liệu không hợp lệ.', 502); }
  if (!response.ok) throw new ApiError(payload?.error?.message ?? 'Yêu cầu thất bại. Vui lòng thử lại.', response.status);
  if (payload?.data === undefined) throw new ApiError('Máy chủ trả về dữ liệu không hợp lệ.', 502);
  return payload.data;
}

export async function accessToken(forceRefresh = false): Promise<string> {
  const current = readSession();
  if (!current) throw new ApiError('Vui lòng đăng nhập.', 401);
  if (!forceRefresh && current.expires_at > Date.now() / 1000 + 30) return current.access_token;
  if (!refreshInFlight) {
    const refreshingToken = current.refresh_token;
    const refreshingVersion = sessionVersion;
    refreshInFlight = rawRequest<AuthResult>('/auth/refresh', {
      method: 'POST', body: JSON.stringify({ refresh_token: refreshingToken }),
    }).then((result) => {
      if (sessionVersion !== refreshingVersion || readSession()?.refresh_token !== refreshingToken) throw new ApiError('Phiên đăng nhập đã thay đổi.', 401);
      if (!result.session) throw new ApiError('Phiên đăng nhập đã hết hạn.', 401);
      saveSession(result.session, true);
      return result.session;
    }).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 401 && sessionVersion === refreshingVersion && readSession()?.refresh_token === refreshingToken) saveSession(null);
      throw error;
    }).finally(() => { refreshInFlight = null; });
  }
  return (await refreshInFlight).access_token;
}

export async function authenticatedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const requestVersion = sessionVersion;
  const ensureSameAccount = () => {
    if (requestVersion !== sessionVersion) throw new ApiError('Phiên đăng nhập đã thay đổi.', 401);
  };
  const token = await accessToken();
  const send = async (value: string) => {
    ensureSameAccount();
    const data = await rawRequest<T>(path, { ...options, headers: { ...options.headers, Authorization: `Bearer ${value}` } });
    ensureSameAccount();
    return data;
  };
  try { return await send(token); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    ensureSameAccount();
    const renewed = await accessToken(true);
    try { return await send(renewed); }
    catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401 && readSession()?.access_token === renewed) saveSession(null);
      throw retryError;
    }
  }
}

export const authApi = {
  login: (email: string, password: string) => rawRequest<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string) => rawRequest<AuthResult>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => authenticatedRequest<AccountUser>('/auth/me'),
  logout: (token: string) => rawRequest<{ signed_out: boolean }>('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }),
};
