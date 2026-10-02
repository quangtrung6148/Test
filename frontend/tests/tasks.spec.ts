import { expect, test } from '@playwright/test';

const task = {
  id: 'c7306bcd-5ce5-4a0a-a5b9-d916ee2b3aa8', title: 'Viết tài liệu triển khai',
  description: 'Ghi lại các bước cấu hình môi trường.', status: 'pending',
  created_at: '2026-10-02T00:00:00Z', updated_at: '2026-10-02T00:00:00Z',
};
const api = '**/api/v1/tasks**';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('nhip.account-session', JSON.stringify({ access_token: 'test-access', refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600 })));
  await page.route('**/api/v1/auth/me', route => {
    expect(route.request().headers().authorization).toBe('Bearer test-access');
    return route.fulfill({ json: { data: { id: 'test-user', email: 'user@example.com' } } });
  });
});

test('adds and completes a task using the API', async ({ page }) => {
  await page.route(api, async (route) => {
    const method = route.request().method();
    if (method === 'GET') await route.fulfill({ json: { data: [] } });
    else if (method === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ title: task.title, description: task.description });
      await route.fulfill({ status: 201, json: { data: task } });
    } else if (method === 'PATCH') {
      expect(route.request().postDataJSON()).toEqual({ status: 'completed' });
      await route.fulfill({ json: { data: { ...task, status: 'completed' } } });
    }
  });
  await page.goto('/');
  await expect(page.getByText('Một trang mới, một khởi đầu mới.')).toBeVisible();
  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  await expect(page.getByLabel('Tiêu đề')).toBeFocused();
  await page.getByLabel('Tiêu đề').fill(`  ${task.title}  `);
  await page.getByLabel('Mô tả').fill(task.description);
  await page.getByRole('button', { name: 'Lưu công việc' }).click();
  await expect(page.getByRole('status')).toContainText('Đã thêm công việc mới.');
  await expect(page.getByRole('heading', { name: task.title })).toBeVisible();
  await page.getByRole('button', { name: `Hoàn thành: ${task.title}` }).click();
  await expect(page.getByText('Đã hoàn thành', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `Hoàn thành: ${task.title}` })).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
});

test('shows loading, API error and retries successfully', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  await page.route(api, async (route) => {
    calls++;
    if (calls === 1) {
      await gate;
      await route.fulfill({ status: 503, json: { error: { message: 'Dữ liệu tạm thời không khả dụng.' } } });
    } else await route.fulfill({ json: { data: [task] } });
  });
  await page.goto('/');
  await expect(page.getByText('Đang tải công việc…')).toBeVisible();
  release();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Dữ liệu tạm thời không khả dụng.');
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('heading', { name: task.title })).toBeVisible();
});

test('preserves task status when completion fails', async ({ page }) => {
  await page.route(api, (route) => route.fulfill(route.request().method() === 'PATCH'
    ? { status: 503, json: { error: { message: 'Không lưu được công việc.' } } }
    : { json: { data: [task] } }));
  await page.goto('/');
  const complete = page.getByRole('button', { name: `Hoàn thành: ${task.title}` });
  await complete.click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Không lưu được công việc.');
  await expect(page.getByText('Đang chờ', { exact: true })).toBeVisible();
  await expect(complete).toBeEnabled();
});

test('retains form input after creation error', async ({ page }) => {
  await page.route(api, (route) => route.fulfill(route.request().method() === 'POST'
    ? { status: 400, json: { error: { message: 'Dữ liệu không hợp lệ.' } } }
    : { json: { data: [] } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  await page.getByLabel('Tiêu đề').fill('Công việc mới');
  await page.getByRole('button', { name: 'Lưu công việc' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Dữ liệu không hợp lệ.');
  await expect(page.getByLabel('Tiêu đề')).toHaveValue('Công việc mới');
  await expect(page.getByRole('button', { name: 'Lưu công việc' })).toBeEnabled();
});

test('locks submit until the API request finishes', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let posts = 0;
  await page.route(api, async (route) => {
    if (route.request().method() === 'POST') {
      posts++;
      await gate;
      await route.fulfill({ status: 201, json: { data: task } });
    } else await route.fulfill({ json: { data: [] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  await page.getByLabel('Tiêu đề').fill(task.title);
  await page.getByRole('button', { name: 'Lưu công việc' }).click();
  await expect(page.getByRole('button', { name: 'Đang thêm…' })).toBeDisabled();
  await expect(page.getByLabel('Tiêu đề')).toBeDisabled();
  expect(posts).toBe(1);
  release();
  await expect(page.getByRole('heading', { name: task.title })).toBeVisible();
});

test('renders long text without horizontal overflow and uses accessible controls', async ({ page }) => {
  await page.route(api, (route) => route.fulfill({ json: { data: [{ ...task, title: 'x'.repeat(120), description: 'd'.repeat(2000) }] } }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Hoàn thành:/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const button = await page.getByRole('button', { name: /Hoàn thành:/ }).boundingBox();
  expect(button?.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: `test-results/layout-${test.info().project.name}.png`, fullPage: true });
});
