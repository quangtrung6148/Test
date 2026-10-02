# Tiếp tục deployment Mini Task App — phương án $0

Yêu cầu hiện tại: **Vercel Hobby frontend + Render Free backend + Supabase hiện tại; không tạo bất kỳ tài nguyên trả phí nào. Worker bỏ khỏi production.** Yêu cầu này thay thế cấu hình hai dịch vụ Render trả phí trước đó. Mã nguồn public tại **https://github.com/quangtrung6148/Test**, nhánh `main`. Commit app `57ce76c` giữ nguyên cây mã nguồn đã kiểm thử của commit local `2d9421a`; commit khởi tạo repository trước đó đã được hợp nhất.

## Trạng thái đã xác minh

- Build, typecheck, lint đạt; 56 test backend + 9 worker + 42 Playwright = 107 test đạt.
- Source đã push không chứa giá trị secret thật; chỉ các `.env.example` được commit.
- Supabase project: `pafbhhlogzhqlgwennih`, URL `https://pafbhhlogzhqlgwennih.supabase.co`.
- Bảng `public.tasks` đã có. Kiểm tra schema mới trong lượt chuyển sang $0 ngày 02/10/2026: chọn `id,user_id` trả `200`, không có lỗi, đọc được một hàng. Cột `user_id` đã có; không chạy lại migration 002. Metadata FK/constraint/index chưa được kiểm tra bằng quyền SQL.
- Email Auth được bật, cho phép đăng ký, cần xác nhận email. Backend local + Supabase thật đã đạt đăng nhập/đăng xuất, tạo/đọc/complete task, owner isolation giữa hai tài khoản, complete lặp giữ timestamp và không token 401. Hai tài khoản thử tạo bằng Admin API với email xác nhận sẵn, đã cleanup cùng task; không gửi email. Chưa nghiệm thu đường đăng ký/gửi thư hoặc browser/cloud.
- `render.yaml` đạt JSON Schema Render; đúng một web Free, previews off. Field đang dùng trong `frontend/vercel.json` đạt theo định nghĩa schema Vercel chính thức. Chưa sync/validate trên tài khoản cloud.
- Vercel, Render, Supabase được hệ thống xác nhận cài đặt. Người dùng báo đã kiểm tra truy cập ở phiên khác: Vercel team `Rannn`, Render workspace `Rannn`, một Supabase project `ACTIVE_HEALTHY`. Tiếp tục trong phiên có công cụ của ba dịch vụ, kiểm tra lại đúng tài khoản/project trước khi tạo tài nguyên.
- Chưa có URL deployment Vercel/Render được xác minh. Không coi GitHub publication là deployment app.

## Ràng buộc $0

- Kiểm tra tài nguyên hiện có và plan/billing trước khi tạo hoặc thay đổi để tránh tạo trùng và phát sinh phí.
- Vercel chỉ dùng **Hobby**; không nâng Pro, bật trial trả phí, add-on, mua domain hoặc cài integration trả phí.
- Render chỉ triển khai **một Web Service Free**, tên `mini-task-api`. `render.yaml` không có worker, database, Redis, cron, disk hoặc preview stack.
- Render Free vẫn dùng quota bandwidth/build. Workspace có phương thức thanh toán có thể bị tính phí vượt quota theo [tài liệu Render](https://render.com/docs/free). Để đáp ứng $0, cần xác minh workspace miễn phí không có phương thức thanh toán và không bật phí vượt quota. Không tự thay đổi billing hoặc gỡ phương thức thanh toán đang dùng; nếu chưa đáp ứng, dừng thao tác cloud để người dùng chọn workspace phù hợp.
- Supabase giữ nguyên project/gói hiện tại. Không tạo tài nguyên hoặc nâng gói. Nếu project hiện có đã thuộc gói trả phí, báo rõ thay vì khẳng định toàn bộ stack $0.
- Không deploy worker cloud, không thêm job/ping để giữ Render luôn thức. Worker vẫn nằm trong source và chạy local bằng npm/Docker Compose.

## Các bước triển khai còn lại

1. Đọc `README.md`, `render.yaml`, `frontend/vercel.json`, `backend/Dockerfile` và migration `supabase/migrations/002_task_accounts.sql` từ repo.
2. Kiểm tra schema. Nếu cột `user_id` chưa có, áp dụng **migration 002** vào project đã nêu. Bảng từ migration 001 đã tồn tại; không chạy lại 001. Nếu 002 đã được áp dụng bởi phiên khác, kiểm tra constraint/index thay vì áp dụng lại.
3. Kiểm tra tài nguyên hiện có và billing trong các tài khoản được chọn. Chỉ tiếp tục khi Vercel Hobby, Render Free workspace đáp ứng ràng buộc $0. Không thay thế bằng tài nguyên trả phí khi hết quota hoặc lỗi. Tạo/link project Vercel từ repo, root `frontend`, framework Next.js, Node 22.x; ghi lại origin production để cấu hình backend.
4. Triển khai backend từ repo bằng Blueprint đã push hoặc service hiện có, root `backend`, runtime Docker, Dockerfile `./Dockerfile`, context `.`, **plan Free**, health `/health`. Bind `0.0.0.0`; Render cung cấp `PORT`. Đặt `NODE_ENV=production`, `SUPABASE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_URL` bằng origin Vercel, `SERVICE_API_KEY` sinh ngẫu nhiên. Internal key vẫn cần dù production không chạy worker.
5. Deploy production frontend Vercel Hobby, root `frontend`, Node.js 22.x. `frontend/vercel.json` đặt install `npm ci`, build `npm run build`, framework Next.js. `NEXT_PUBLIC_API_URL` phải là URL HTTPS backend thật, không kèm `/api/v1`; thay URL phải rebuild/redeploy.
6. Cập nhật `FRONTEND_URL` backend bằng origin Vercel chính thức; cập nhật Supabase Auth Site URL/Redirect URLs cùng frontend. Không đặt server key hoặc service key vào frontend.
7. Bỏ worker production theo yêu cầu. Render Free ngủ sau 15 phút không có inbound traffic; request tiếp theo khởi động lại khoảng một phút. Nếu frontend timeout, đợi backend khởi động rồi thử lại. Dữ liệu nằm ở Supabase; không thêm job/ping giữ backend luôn thức.
8. Nghiệm thu `/health`, đăng ký/xác nhận email/đăng nhập, thêm/hoàn thành task, reload còn dữ liệu, hai tài khoản có task riêng, PATCH task tài khoản khác trả 404, API không token trả 401. Không yêu cầu log worker cloud. Health 200 không thay thế kiểm tra database/Auth.
9. Ghi URL deployment, plan/billing đã xác minh và kết quả thực tế vào `VERIFICATION.md`; đánh dấu riêng phần chưa xác minh. Không báo deploy thành công trước khi kiểm tra URL live và luồng frontend → backend → database.

## Secret và quyền truy cập

Secret thật chỉ nằm trong file env bị ignore tại `F:\Test\backend\.env.development` và `F:\Test\service\.env.development`. Phiên chỉ có cloud tools cần lấy server key bằng kết nối Supabase đã được cấp quyền, hoặc yêu cầu người dùng nhập vào secret environment của nền tảng. Không đưa giá trị secret vào repo hoặc phản hồi chat.

Supabase Data API secret key không cấp quyền thực thi migration SQL. Chạy migration qua Supabase plugin có công cụ SQL đã được cấp quyền hoặc Management API/PostgreSQL credentials phù hợp.

Git local: `F:\Test`, nhánh `main`, origin `https://github.com/quangtrung6148/Test.git`. Khi chạy dưới Windows account ADMIN, Git có thể yêu cầu tùy chọn `-c safe.directory=F:/Test` vì `.git` được tạo bởi tài khoản sandbox. Push bình thường; không force push để ghi đè lịch sử.

## Dashboard fallback

- [Render Blueprint cho repo](https://dashboard.render.com/blueprint/new?repo=https://github.com/quangtrung6148/Test): preview chỉ được có một Web Service Free trước khi Apply.
- [Vercel tạo/import project](https://vercel.com/new): chọn repo `quangtrung6148/Test`, root `frontend`, team Hobby, Node 22.x.
- [Supabase SQL Editor](https://supabase.com/dashboard/project/pafbhhlogzhqlgwennih/sql): kiểm tra/chạy migration 002 nếu thiếu.

Tài liệu chính thức: [Render Free](https://render.com/docs/free), [Render Blueprint](https://render.com/docs/blueprint-spec), [Vercel Hobby](https://vercel.com/docs/plans/hobby).
