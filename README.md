# Nhịp — Mini Task App

Demo mobile-first với đăng ký/đăng nhập, xem công việc, thêm công việc và hoàn thành công việc. Worker kiểm tra task pending vẫn có mã nguồn và chạy local; bản cloud theo yêu cầu $0 chỉ triển khai frontend + backend, dùng Supabase hiện tại.

```text
Next.js / Vercel ──HTTP──► Express / Render ──Supabase SDK──► PostgreSQL / Supabase
Background Worker (local) ──HTTP + Bearer key──► Express
```

App có đăng ký, đăng nhập và đăng xuất bằng email/mật khẩu qua Supabase Auth. Mỗi tài khoản chỉ xem, thêm và hoàn thành task của mình. Frontend và worker không kết nối trực tiếp database; mọi thao tác tài khoản và task đều đi qua Express. Worker kiểm tra tổng số task pending của tất cả tài khoản bằng internal API riêng.

## Yêu cầu

- Node.js 22 và npm (trên PowerShell có thể dùng `npm.cmd` nếu execution policy chặn `npm.ps1`).
- Docker Desktop với Linux containers, Docker Compose v2, nếu chạy bằng Docker.
- Một project Supabase external đã chạy migration.
- Tài khoản GitHub, Vercel Hobby và Render với backend Free để triển khai cloud.

Quy trình: phân tích → kiến trúc/schema/API → triển khai → kiểm thử → Docker → cấu hình deployment.

## Cấu trúc

```text
frontend/       Next.js App Router, UI tiếng Việt, Playwright tests
backend/        Express: config, routes, controllers, services, middleware, tests
service/        Worker độc lập, tests
supabase/       SQL migration
scripts/        Script tổng hợp install/build/typecheck/lint/test
docker-compose.yml
render.yaml
```

Mỗi app có `package.json`, lockfile, `Dockerfile`, `.dockerignore`, `.env.example`. Không dùng workspace build tool hoặc shared package để giữ việc deploy từng app đơn giản.

## 1. Tạo Supabase và schema

1. Tạo project riêng cho demo trong Supabase.
2. Mở **SQL Editor**, chạy [`001_create_tasks.sql`](supabase/migrations/001_create_tasks.sql), sau đó [`002_task_accounts.sql`](supabase/migrations/002_task_accounts.sql). Mỗi migration chỉ chạy một lần. Nếu đã có bảng từ migration 001, chỉ chạy migration 002. Nếu chưa có bảng `tasks`, cần chạy cả hai theo thứ tự.
3. Lấy Project URL và server-only `service_role` key trong **Project Settings → API / API Keys**. Nếu dashboard cung cấp Supabase secret key mới, có thể dùng secret key đó trong cùng biến `SUPABASE_SERVICE_ROLE_KEY`.
4. Chỉ đặt key này trong backend. Không dùng key publishable/anon thay cho server key.

Bảng `tasks`: `id uuid`, `user_id uuid` tham chiếu `auth.users`, `title varchar(120)`, `description text`, `status pending|completed`, `created_at`, `updated_at`. Database kiểm tra giới hạn dữ liệu, tự tạo UUID và cập nhật timestamp khi nội dung/trạng thái thay đổi. Hoàn thành lại không đổi timestamp. Task cũ từ bản dùng chung được giữ lại nhưng không tự gán cho tài khoản nào; người dùng không thấy các task chưa có chủ sở hữu. Mọi task tạo mới bắt buộc có `user_id`.

RLS được bật; `anon` và `authenticated` không có quyền truy cập trực tiếp bảng. Backend dùng server key với quyền select/insert/update. Vì server key bỏ qua RLS, backend xác thực token bằng `auth.getUser()` rồi thêm điều kiện `user_id` vào mọi truy vấn task cá nhân; không nhận chủ sở hữu từ payload. Task của tài khoản khác trả `404`, giống task không tồn tại. Không có delete API. Không tự seed dữ liệu khi khởi động; thêm task qua UI.

### Cấu hình đăng ký và đăng nhập

Trong Supabase **Authentication**, bật provider **Email** và cho phép người dùng đăng ký. Trong **URL Configuration**, đặt **Site URL** và thêm **Redirect URLs** là `http://localhost:3000` khi chạy local; khi deploy, thêm URL Vercel chính thức. Backend gửi `FRONTEND_URL` làm URL quay về sau xác nhận email.

- Khi **Confirm email** bật: đăng ký xong cần mở email xác nhận, rồi quay về app đăng nhập. Nếu chưa xác nhận, app hiển thị thông báo tương ứng. Kiểm tra cấu hình gửi email/rate limit của Supabase nếu không nhận được thư.
- Khi **Confirm email** tắt: đăng ký thành công đăng nhập ngay. Chỉ thay thiết lập này nếu phù hợp với môi trường của bạn.
- Mật khẩu đăng ký tối thiểu 8, tối đa 128 ký tự; Supabase có thể yêu cầu mạnh hơn theo cấu hình project. Mật khẩu không được lưu trong app hoặc log.
- Phiên đăng nhập nằm trong `sessionStorage` của tab và được giữ khi reload; đóng tab cần đăng nhập lại. Nếu browser chặn storage, phiên chỉ tồn tại trong bộ nhớ. App tự làm mới token trước khi hết hạn hoặc sau lỗi `401`; phiên không hợp lệ quay về form đăng nhập. Đăng xuất xóa task/phiên trên trình duyệt ngay và yêu cầu Supabase thu hồi refresh token của phiên đó. Access token đã cấp có hiệu lực đến thời điểm hết hạn theo cơ chế Supabase.

Tham khảo [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords) và [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## 2. Cấu hình local

PowerShell:

```powershell
Copy-Item frontend/.env.example frontend/.env.development
Copy-Item backend/.env.example backend/.env.development
Copy-Item service/.env.example service/.env.development
```

Bash:

```bash
cp frontend/.env.example frontend/.env.development
cp backend/.env.example backend/.env.development
cp service/.env.example service/.env.development
```

Sửa `backend/.env.development`: điền URL/key Supabase thật. Tạo `SERVICE_API_KEY` ngẫu nhiên bằng lệnh sau rồi đặt **cùng một giá trị** trong backend và service:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

| App | Biến | Local |
|---|---|---|
| frontend | `NEXT_PUBLIC_API_URL` | `http://localhost:5000` |
| backend | `PORT` | `5000` |
| backend | `NODE_ENV` | `development` |
| backend | `SUPABASE_URL` | URL project thật |
| backend | `SUPABASE_SERVICE_ROLE_KEY` | Server key thật |
| backend | `FRONTEND_URL` | `http://localhost:3000` |
| backend + service | `SERVICE_API_KEY` | Cùng secret ngẫu nhiên, ít nhất 32 ký tự |
| service | `NODE_ENV` | `development` |
| service | `BACKEND_URL` | `http://localhost:5000` khi chạy npm |
| service | `POLL_INTERVAL_MS` | `60000` |

Template là hướng dẫn, không phải credentials hoạt động. Backend/service dừng khi env thiếu hoặc chứa placeholder; thông báo chỉ tên biến, không in secret. Environment đã có trong process được ưu tiên hơn file `.env.<NODE_ENV>`.

## 3. Chạy bằng Docker

Sau khi cấu hình Supabase và hai file backend/service ở trên:

```bash
docker compose up --build
```

Mở `http://localhost:3000`. API ở `http://localhost:5000`. Compose chạy đúng ba container; database vẫn ở Supabase external. Backend có health check, frontend/worker chờ backend healthy.

Compose đọc backend/service `.env.development`, ghi đè `NODE_ENV=production`, `PORT=5000`, và worker `BACKEND_URL=http://backend:5000`. Frontend chạy bản production standalone. File env và tests không nằm trong Docker image.

`NEXT_PUBLIC_API_URL` được đóng vào frontend lúc **build**, không thay đổi bằng environment lúc chạy. Build arg Compose mặc định `http://localhost:5000`; Compose không đọc frontend `.env.development` để nội suy build arg. Nếu cần đổi, đặt biến trong shell trước khi build:

```powershell
$env:NEXT_PUBLIC_API_URL = 'http://localhost:5000'
docker compose up --build
```

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000 docker compose up --build
```

Nếu mở app từ điện thoại trong LAN, dùng URL API theo IP LAN của máy và đổi `FRONTEND_URL` cho khớp origin frontend, rồi build lại. Browser không dùng hostname `backend`; hostname đó chỉ có trong mạng Docker.

```bash
docker compose ps
docker compose logs -f service
docker compose down
```

`/health` chỉ kiểm tra backend còn hoạt động; kiểm tra database bằng `GET /api/v1/tasks`.

## 4. Chạy bằng npm

Từ root:

```bash
npm run setup
```

Mở ba terminal tại root:

```bash
npm --prefix backend run dev
npm --prefix service run dev
npm --prefix frontend run dev
```

Production local: tạo `.env.production` cho mỗi app từ template, điền giá trị thật; backend vẫn cần `PORT`. Frontend dùng `.env.production` tại thời điểm build. Chạy build từ root:

```bash
npm run build
```

Trong terminal backend và service, đặt `NODE_ENV=production` trước khi chạy `npm --prefix <app> start`. Ví dụ PowerShell:

```powershell
$env:NODE_ENV = 'production'
npm --prefix backend start
```

Terminal khác chạy worker tương tự, terminal frontend chạy `npm --prefix frontend start`. Không commit `.env.production`.

## REST API

Task có `id`, `title`, `description`, `status`, `created_at`, `updated_at`; timestamp ISO 8601 UTC.

| Method | URL | Input / response |
|---|---|---|
| GET | `/health` | `200 {"status":"ok"}` |
| POST | `/api/v1/auth/register` | `{ "email": "ban@example.com", "password": "password123" }` → `201 {"data":AuthResult}` |
| POST | `/api/v1/auth/login` | Email/mật khẩu → `200 {"data":AuthResult}` |
| POST | `/api/v1/auth/refresh` | `{ "refresh_token": "..." }` → `200 {"data":AuthResult}` |
| GET | `/api/v1/auth/me` | Bearer access token → `200 {"data":{"id":"...","email":"..."}}` |
| POST | `/api/v1/auth/logout` | Bearer access token → `200 {"data":{"signed_out":true}}` |
| GET | `/api/v1/tasks` | `200 {"data":[Task]}`, mới nhất trước |
| POST | `/api/v1/tasks` | `{ "title": "Viết README", "description": "Hướng dẫn deploy" }` → `201 {"data":Task}` |
| PATCH | `/api/v1/tasks/:id` | `{ "status": "completed" }` → `200 {"data":Task}` |
| GET | `/api/v1/internal/tasks/pending` | Bearer `SERVICE_API_KEY` → `200 {"data":[Task]}` |

Ba endpoint task cá nhân đều yêu cầu `Authorization: Bearer <access_token>`. `AuthResult` có `user: {id,email} | null`, `session: {access_token,refresh_token,expires_at} | null` và `confirmation_required: boolean`. Khi cần xác nhận email, `session` là `null`. Secret backend/service không phải token đăng nhập và không cho phép truy cập task cá nhân.

Title được trim, dài 1–120 ký tự; description không bắt buộc, tối đa 2.000 ký tự, mặc định `""`. PATCH chỉ hỗ trợ completed; field ngoài hợp đồng bị từ chối. Backend chia truy vấn thành từng batch 1.000 hàng để tránh mất task do giới hạn phản hồi mặc định của Supabase; giao diện không phân trang trong demo này. Giữ Supabase API max rows ở mặc định 1.000 hoặc cao hơn.

Lỗi: `{ "error": { "code": "INVALID_INPUT", "message": "Dữ liệu không hợp lệ." } }`.

- `400`: payload/UUID/JSON không hợp lệ.
- `401`: chưa đăng nhập, token/refresh token không hợp lệ, email/mật khẩu sai hoặc internal service key thiếu/sai.
- `403`: email chưa xác nhận hoặc đăng ký bị đóng.
- `404`: task không tồn tại/thuộc tài khoản khác hoặc endpoint không tồn tại.
- `429`: Supabase giới hạn số lần thử xác thực.
- `413`: JSON body quá 16 KB.
- `503`: Supabase không phản hồi hoặc từ chối truy vấn.
- `500`: lỗi ngoài dự kiến, không trả stack trace/secret.

Worker chạy lần đầu ngay khi khởi động, sau đó đợi `POLL_INTERVAL_MS` sau mỗi lần kiểm tra. Timeout request 10 giây; không có request chồng nhau. Network/API error được ghi log mã lỗi và kiểm tra lại vòng tiếp theo. SIGINT/SIGTERM hủy request hoặc thời gian chờ rồi thoát.

Log ví dụ:

```json
{"event":"pending_tasks_checked","timestamp":"2026-10-02T00:00:00.000Z","pending_count":2}
```

## Kiểm thử

Các test mock API/database chỉ chạy trong test, không phải storage thay thế trong app.

```bash
npm run build
npm run typecheck
npm run lint
npm --prefix frontend run test:install
npm run test
```

Playwright cần Chromium; `test:install` tải browser nếu máy chưa có. Frontend test dùng **bản build production** chạy ở port `3100`; build trước khi test. API URL mock trong test tương ứng URL mặc định local.

- Backend: Supertest + Vitest kiểm tra routes, đăng ký/đăng nhập/refresh/logout, token thiếu/sai, validation, CORS/security headers, xử lý lỗi; mock HTTP Supabase kiểm tra Auth SDK, owner filter, complete lặp lại và race giữa hai request.
- Worker: Vitest kiểm tra Bearer header, pending count, lỗi mạng/HTTP, timeout, chu kỳ polling, chống overlap và shutdown.
- Frontend: Playwright kiểm tra đăng ký với/không có xác nhận email, nhập lại mật khẩu, đăng nhập, reload/đăng xuất, refresh và phiên hết hạn, đổi tài khoản khi request còn chạy; thêm/complete, loading/error/retry, lỗi mutation, khóa nút và bố cục 375/768/1440 px.

Kiểm tra tích hợp thật sau khi có Docker/Supabase:

1. Chạy `docker compose config --quiet`, rồi `docker compose up --build`.
2. Kiểm tra `/health`, mở UI, đăng ký/xác nhận email/đăng nhập và thêm task.
3. Reload trang, kiểm tra task vẫn tồn tại và có trong Supabase Table Editor.
4. Hoàn thành task, reload, kiểm tra trạng thái và `updated_at`.
5. PATCH completed lần nữa; `updated_at` phải giữ nguyên.
6. Gọi internal API không key/sai key → `401`; key đúng → danh sách pending.
7. Kiểm tra `docker compose logs service`: count pending giảm sau khi complete.
8. Đăng nhập bằng tài khoản thứ hai: danh sách riêng; thử PATCH UUID task của tài khoản thứ nhất → `404`. Không token → `401`. Đăng xuất: task cũ biến mất; reload vẫn ở form đăng nhập.
9. Restart worker, xác minh vẫn chạy; không có server/service secret trong browser bundle/log.

## Public GitHub

Mã nguồn đã public tại [quangtrung6148/Test](https://github.com/quangtrung6148/Test), nhánh `main`. Khi cập nhật, kiểm tra chỉ có `.env.example` được theo dõi trước khi commit/push:

```bash
git status --short
git ls-files
git diff --cached --name-only
git diff --cached
```

`.gitignore` đã loại `.env`, `.env.*` chứa giá trị thật, build output, dependencies và test artifacts. Nếu bạn đã commit secret trước đó, việc ignore không xóa secret khỏi lịch sử: thay key và xử lý lịch sử trước khi public.

## Deploy Vercel / Render

Phương án đã chọn: **Vercel Hobby frontend + một Render Free backend + Supabase hiện tại**, không tạo tài nguyên trả phí. `render.yaml` chỉ khai báo một Web Service có `plan: free`, tắt Blueprint previews; không khai báo worker, database, Redis, disk hoặc cron. Không nâng gói tài khoản hoặc bật add-on. Mã nguồn worker và Docker Compose ba container vẫn dùng được khi chạy local.

Trước khi Apply, xác minh Vercel đang ở **Hobby**, Supabase project hiện tại không bị nâng gói và Render đang dùng **Free**. Render Free vẫn tính vào quota bandwidth/build của workspace; nếu workspace đã có phương thức thanh toán, Render có thể thu phí vượt quota. Để giữ $0, dùng workspace miễn phí không có phương thức thanh toán và không bật thanh toán vượt quota. Không tự thay đổi billing, phương thức thanh toán hoặc tài nguyên đang dùng của tài khoản. Nếu workspace không đáp ứng điều kiện này, dừng deployment để chọn workspace phù hợp. Xem [Render Free](https://render.com/docs/free) và [Vercel Hobby](https://vercel.com/docs/plans/hobby).

Backend Free ngủ sau 15 phút không có request; request tiếp theo có thể cần khoảng một phút để khởi động lại. Nếu UI báo lỗi kết nối ở lần đầu, đợi backend khởi động rồi thử lại. Task vẫn lưu ở Supabase. Không chạy worker cloud hoặc thêm job ping để giữ backend luôn thức.

### Vercel — frontend

1. Trong tài khoản/team **Hobby**, import [GitHub repository](https://github.com/quangtrung6148/Test), đặt **Root Directory = frontend**, framework Next.js; không chọn Pro/trial/add-on.
2. Chọn Node.js **22.x**. `frontend/vercel.json` đặt build `npm run build`, install `npm ci`.
3. Đặt `NEXT_PUBLIC_API_URL=https://<render-backend>.onrender.com` cho Production; không thêm `/api/v1` vào biến này.
4. Deploy và lấy URL production chính thức. Nếu chưa có URL backend, hoàn tất Render trước rồi cập nhật Vercel env và redeploy.
5. Đổi env public cần **redeploy** vì Next.js nhúng biến lúc build. Không đưa bất kỳ Supabase/service key nào vào Vercel.

### Render — backend Free

Mở [Blueprint từ repository](https://dashboard.render.com/blueprint/new?repo=https://github.com/quangtrung6148/Test), dùng `render.yaml` trên nhánh `main`. Kiểm tra preview chỉ có **mini-task-api**, loại **Web Service**, plan **Free / $0** trước khi Apply. Nhập các biến `sync: false` trong dashboard. Nếu dashboard đề nghị tài nguyên trả phí, không Apply.

| Tài nguyên | Biến production | Cách đặt |
|---|---|---|
| backend | `NODE_ENV` | `production` trong YAML |
| backend | `PORT` | Render tự cung cấp; app bind `0.0.0.0` |
| backend | `SUPABASE_URL` | Nhập URL project Supabase |
| backend | `SUPABASE_SERVICE_ROLE_KEY` | Nhập server key vào secret env |
| backend | `FRONTEND_URL` | Nhập origin Vercel production chính xác, không có path |
| backend | `SERVICE_API_KEY` | Blueprint sinh tự động |

Backend vẫn yêu cầu `SERVICE_API_KEY` cho internal API; Blueprint sinh tự động dù production không chạy worker. Browser gọi URL HTTPS public của backend; không dùng private hostname hoặc localhost trong Vercel production.

Cũng có thể tạo thủ công: backend **Web Service**, chọn **Free**, Root Directory `backend`, Dockerfile `./Dockerfile`, Docker context `.`, health path `/health`, cùng biến môi trường như bảng. Khi tạo thủ công, tự sinh service key ngẫu nhiên tối thiểu 32 ký tự. Không tạo Background Worker trong phương án $0.

Sau khi có URL chính thức, cập nhật `FRONTEND_URL` của backend, `NEXT_PUBLIC_API_URL` của frontend và Site URL/Redirect URLs trong Supabase Auth. CORS chỉ cho phép một origin chính thức; URL Vercel preview khác domain chưa được cho phép. Nếu dùng preview để demo, cấu hình backend và Supabase Auth tương ứng rồi đổi lại production.

Nghiệm thu cloud: health backend → đăng ký/xác nhận email/đăng nhập → tạo/complete task từ Vercel → reload kiểm tra lưu trữ → hai tài khoản có task riêng → kiểm tra không có secret trong GitHub/frontend. `/health` thành công không đủ để kết luận Supabase đã kết nối. Worker production được bỏ theo yêu cầu; không có bước nghiệm thu worker cloud.

## Deployment checklist

Trạng thái kiểm tra thực tế được ghi tại [`VERIFICATION.md`](VERIFICATION.md). Đánh dấu các ô dưới đây sau khi đã chạy tương ứng:

- [ ] Next.js chạy local
- [ ] Node.js Backend chạy local
- [ ] Background Service chạy
- [ ] Docker Compose chạy được
- [ ] Supabase kết nối được
- [ ] Billing đã kiểm tra: Vercel Hobby, Render Free không bật phí vượt quota, Supabase hiện tại không nâng gói
- [ ] Backend deploy Render Free — chưa xác minh
- [x] Worker production bỏ khỏi Blueprint theo yêu cầu $0
- [ ] Frontend deploy Vercel Hobby — chưa xác minh
- [ ] Vercel gọi được Render API — xác minh sau deploy
- [ ] Không có secret trên GitHub — kiểm tra trước và sau push

Tài liệu chính thức: [Next.js standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [Next.js environment](https://nextjs.org/docs/app/guides/environment-variables), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Docker startup order](https://docs.docker.com/compose/how-tos/startup-order/).
