# Tiếp tục deployment Mini Task App

Người dùng đã yêu cầu triển khai app lên cloud theo stack Next.js → Vercel, Express → Render, PostgreSQL/Auth → Supabase. Mã nguồn đã được public tại **https://github.com/quangtrung6148/Test**, nhánh `main`. Commit app `57ce76c` giữ nguyên cây mã nguồn đã kiểm thử của commit local `2d9421a`; commit khởi tạo repository trước đó đã được hợp nhất.

## Trạng thái đã xác minh

- Build, typecheck, lint đạt; 56 test backend + 9 worker + 42 Playwright = 107 test đạt.
- Source đã push không chứa giá trị secret thật; chỉ các `.env.example` được commit.
- Supabase project: `pafbhhlogzhqlgwennih`, URL `https://pafbhhlogzhqlgwennih.supabase.co`.
- Bảng `public.tasks` đã có. Kiểm tra schema thật ngày 02/10/2026 trả `400 / 42703` khi chọn `user_id`; migration tài khoản chưa được áp dụng.
- Email Auth được bật, cho phép đăng ký, cần xác nhận email. Chưa nghiệm thu gửi thư hoặc đăng nhập thành công bằng tài khoản thật.
- Vercel, Render, Supabase được hệ thống xác nhận cài đặt. Người dùng báo đã kiểm tra truy cập ở phiên khác: Vercel team `Rannn`, Render workspace `Rannn`, một Supabase project `ACTIVE_HEALTHY`. Tiếp tục trong phiên có công cụ của ba dịch vụ, kiểm tra lại đúng tài khoản/project trước khi tạo tài nguyên.
- Chưa có URL deployment Vercel/Render được xác minh. Không coi GitHub publication là deployment app.

## Các bước triển khai còn lại

1. Đọc `README.md`, `render.yaml`, hai Dockerfile backend/service và migration `supabase/migrations/002_task_accounts.sql` từ repo.
2. Kiểm tra schema. Nếu cột `user_id` chưa có, áp dụng **migration 002** vào project đã nêu. Bảng từ migration 001 đã tồn tại; không chạy lại 001. Nếu 002 đã được áp dụng bởi phiên khác, kiểm tra constraint/index thay vì áp dụng lại.
3. Kiểm tra tài nguyên hiện có trong các tài khoản được chọn để tránh tạo trùng. `render.yaml` khai báo hai service dùng gói trả phí `0.5c-512mb`: backend web service `mini-task-api`, background worker `mini-task-worker`. Xác nhận chi phí với người dùng trước khi tạo tài nguyên trả phí.
4. Triển khai backend từ repo, root `backend`, runtime Docker, Dockerfile `./Dockerfile`, context `.`, health `/health`. Bind `0.0.0.0`; Render cung cấp `PORT`. Đặt `NODE_ENV=production`, `SUPABASE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_URL`, `SERVICE_API_KEY`.
5. Triển khai frontend Vercel, root `frontend`, Node.js 22, install `npm ci`, build `npm run build`, framework Next.js. `NEXT_PUBLIC_API_URL` phải là URL HTTPS backend thật, không kèm `/api/v1`; thay URL phải rebuild/redeploy.
6. Cập nhật `FRONTEND_URL` backend bằng origin Vercel chính thức; cập nhật Supabase Auth Site URL/Redirect URLs cùng frontend. Không đặt server key hoặc service key vào frontend.
7. Triển khai worker từ root `service`, runtime Docker, Dockerfile `./Dockerfile`, context `.`. Đặt `NODE_ENV=production`, `BACKEND_URL` bằng URL HTTPS backend thật, `POLL_INTERVAL_MS=60000`, `SERVICE_API_KEY` giống backend.
8. Nghiệm thu `/health`, đăng ký/xác nhận email/đăng nhập, thêm/hoàn thành task, reload còn dữ liệu, hai tài khoản có task riêng, PATCH task tài khoản khác trả 404, API không token trả 401, worker log `pending_tasks_checked`. Health 200 không thay thế kiểm tra database/Auth.
9. Ghi URL deployment và kết quả thực tế vào `VERIFICATION.md`; đánh dấu riêng phần chưa xác minh.

## Secret và quyền truy cập

Secret thật chỉ nằm trong file env bị ignore tại `F:\Test\backend\.env.development` và `F:\Test\service\.env.development`. Phiên chỉ có cloud tools cần lấy server key bằng kết nối Supabase đã được cấp quyền, hoặc yêu cầu người dùng nhập vào secret environment của nền tảng. Không đưa giá trị secret vào repo hoặc phản hồi chat.

Supabase Data API secret key không cấp quyền thực thi migration SQL. Chạy migration qua Supabase plugin có công cụ SQL đã được cấp quyền hoặc Management API/PostgreSQL credentials phù hợp.

Git local: `F:\Test`, nhánh `main`, origin `https://github.com/quangtrung6148/Test.git`. Khi chạy dưới Windows account ADMIN, Git có thể yêu cầu tùy chọn `-c safe.directory=F:/Test` vì `.git` được tạo bởi tài khoản sandbox. Push bình thường; không force push để ghi đè lịch sử.
