import { expect, test, type Page } from '@playwright/test';

const user = { id: 'account-one', email: 'user@example.com' };
const session = { access_token: 'test-access', refresh_token: 'test-refresh', expires_at: 2_000_000_000 };
const result = { user, session, confirmation_required: false };
const task = { id: 'task-one', title: 'Công việc riêng', description: '', status: 'pending', created_at: '2026-10-02T00:00:00Z', updated_at: '2026-10-02T00:00:00Z' };
async function fillLogin(page: Page) {
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('password123');
}
async function seed(page: Page, expiresAt = session.expires_at) {
  await page.addInitScript(value => {
    if (!sessionStorage.getItem('nhip.test-seeded')) {
      sessionStorage.setItem('nhip.account-session', JSON.stringify(value));
      sessionStorage.setItem('nhip.test-seeded', '1');
    }
  }, { ...session, expires_at: expiresAt });
}

test('guests see login and never request private tasks; layout fits viewport', async ({ page }) => {
  let taskCalls = 0;
  await page.route('**/api/v1/tasks**', route => { taskCalls++; return route.fulfill({ json: { data: [] } }); });
  await page.goto('/');
  await expect(page.getByRole('form', { name: 'Đăng nhập tài khoản' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thêm công việc', exact: true })).toHaveCount(0);
  expect(taskCalls).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/account-${test.info().project.name}.png`, fullPage: true });
});

test('registration validates repeated password and explains email confirmation', async ({ page }) => {
  let registrations = 0;
  await page.route('**/api/v1/auth/register', route => {
    registrations++;
    expect(route.request().postDataJSON()).toEqual({ email: user.email, password: 'password123' });
    return route.fulfill({ status: 201, json: { data: { user, session: null, confirmation_required: true } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await fillLogin(page);
  await page.getByLabel('Nhập lại mật khẩu').fill('different123');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Mật khẩu nhập lại chưa khớp.');
  expect(registrations).toBe(0);
  await page.getByLabel('Nhập lại mật khẩu').fill('password123');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByRole('status')).toContainText('Hãy mở email xác nhận rồi đăng nhập.');
  await expect(page.getByRole('form', { name: 'Đăng nhập tài khoản' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('nhip.account-session'))).toBeNull();
});

test('login recovers from incorrect password, persists reload and clears private tasks on logout', async ({ page }) => {
  let logins = 0;
  await page.route('**/api/v1/auth/login', route => {
    logins++;
    return route.fulfill(logins === 1
      ? { status: 401, json: { error: { message: 'Email hoặc mật khẩu không hợp lệ.' } } }
      : { json: { data: result } });
  });
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { data: user } }));
  await page.route('**/api/v1/auth/logout', route => {
    expect(route.request().headers().authorization).toBe('Bearer test-access');
    return route.fulfill({ json: { data: { signed_out: true } } });
  });
  await page.route('**/api/v1/tasks**', route => {
    expect(route.request().headers().authorization).toBe('Bearer test-access');
    return route.fulfill({ json: { data: [task] } });
  });
  await page.goto('/');
  await fillLogin(page);
  const submit = page.getByRole('form').getByRole('button', { name: 'Đăng nhập', exact: true });
  await submit.click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Email hoặc mật khẩu không hợp lệ.');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByRole('heading', { name: task.title })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: task.title })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Đăng nhập tài khoản' })).toBeVisible();
  await expect(page.getByRole('heading', { name: task.title })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('nhip.account-session'))).toBeNull();
  await page.reload();
  await expect(page.getByRole('form', { name: 'Đăng nhập tài khoản' })).toBeVisible();
});

test('registration can sign in immediately when email confirmation is disabled', async ({ page }) => {
  await page.route('**/api/v1/auth/register', route => route.fulfill({ status: 201, json: { data: result } }));
  await page.route('**/api/v1/tasks**', route => route.fulfill({ json: { data: [] } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await fillLogin(page);
  await page.getByLabel('Nhập lại mật khẩu').fill('password123');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
});

test('expired sessions are refreshed before requesting private data', async ({ page }) => {
  await seed(page, 1);
  let refreshes = 0;
  await page.route('**/api/v1/auth/refresh', route => {
    refreshes++;
    expect(route.request().postDataJSON()).toEqual({ refresh_token: 'test-refresh' });
    return route.fulfill({ json: { data: { ...result, session: { ...session, access_token: 'renewed-access', refresh_token: 'renewed-refresh' } } } });
  });
  await page.route('**/api/v1/auth/me', route => {
    expect(route.request().headers().authorization).toBe('Bearer renewed-access');
    return route.fulfill({ json: { data: user } });
  });
  await page.route('**/api/v1/tasks**', route => {
    expect(route.request().headers().authorization).toBe('Bearer renewed-access');
    return route.fulfill({ json: { data: [task] } });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: task.title })).toBeVisible();
  expect(refreshes).toBe(1);
});

test('invalid refresh ends the session without requesting any tasks', async ({ page }) => {
  await seed(page);
  let tasks = 0;
  await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 401, json: { error: { message: 'Phiên không hợp lệ.' } } }));
  await page.route('**/api/v1/auth/refresh', route => route.fulfill({ status: 401, json: { error: { message: 'Phiên đã hết hạn.' } } }));
  await page.route('**/api/v1/tasks**', route => { tasks++; return route.fulfill({ json: { data: [] } }); });
  await page.goto('/');
  await expect(page.getByRole('form', { name: 'Đăng nhập tài khoản' })).toBeVisible();
  expect(tasks).toBe(0);
  expect(await page.evaluate(() => sessionStorage.getItem('nhip.account-session'))).toBeNull();
});

test('login locks controls while the request is pending and can retry a network failure', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  await page.route('**/api/v1/auth/login', async route => {
    calls++;
    if (calls === 1) {
      await gate;
      await route.abort('failed');
    } else await route.fulfill({ json: { data: result } });
  });
  await page.route('**/api/v1/tasks**', route => route.fulfill({ json: { data: [] } }));
  await page.goto('/');
  await fillLogin(page);
  await page.getByRole('form').getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đang xử lý…' })).toBeDisabled();
  await expect(page.getByLabel('Email', { exact: true })).toBeDisabled();
  expect(calls).toBe(1);
  release();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Không thể kết nối máy chủ.');
  await expect(page.getByRole('form').getByRole('button', { name: 'Đăng nhập', exact: true })).toBeEnabled();
  await page.getByRole('form').getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
  expect(calls).toBe(2);
});

test('switching accounts clears tasks and never retries an old mutation with the new token', async ({ page }) => {
  await seed(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let patches = 0;
  let refreshes = 0;
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { data: user } }));
  await page.route('**/api/v1/auth/logout', route => route.fulfill({ json: { data: { signed_out: true } } }));
  await page.route('**/api/v1/auth/login', route => route.fulfill({ json: { data: {
    ...result, user: { id: 'account-two', email: 'second@example.com' },
    session: { ...session, access_token: 'second-access', refresh_token: 'second-refresh' },
  } } }));
  await page.route('**/api/v1/auth/refresh', route => { refreshes++; return route.fulfill({ json: { data: result } }); });
  await page.route('**/api/v1/tasks**', async route => {
    if (route.request().method() === 'PATCH') {
      patches++;
      expect(route.request().headers().authorization).toBe('Bearer test-access');
      await gate;
      await route.fulfill({ status: 401, json: { error: { message: 'Phiên cũ đã kết thúc.' } } });
    } else await route.fulfill({ json: { data: route.request().headers().authorization === 'Bearer test-access' ? [task] : [] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: `Hoàn thành: ${task.title}` }).click();
  await expect(page.getByRole('button', { name: `Hoàn thành: ${task.title}` })).toBeDisabled();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await fillLogin(page);
  await page.getByRole('form').getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByText('second@example.com', { exact: true })).toBeVisible();
  const response = page.waitForResponse(value => value.request().method() === 'PATCH');
  release();
  await response;
  await expect(page.getByRole('heading', { name: task.title })).toHaveCount(0);
  await expect(page.getByText('Một trang mới, một khởi đầu mới.')).toBeVisible();
  expect(patches).toBe(1);
  expect(refreshes).toBe(0);
});
