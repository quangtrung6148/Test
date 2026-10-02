# Báo cáo kiểm tra — 02/10/2026

Triển khai tại `F:\Test` bằng Node.js `22.14.0`, npm `10.9.2`. Đã bổ sung đăng ký/đăng nhập/đăng xuất bằng Supabase Auth và task riêng cho từng tài khoản theo yêu cầu cập nhật. Mã nguồn đã public tại [quangtrung6148/Test](https://github.com/quangtrung6148/Test); chưa deploy cloud.

## Cập nhật khi bắt đầu deployment

- Đã push mã nguồn lên nhánh `main`, commit `57ce76c`; hợp nhất commit khởi tạo `README.md` của repository và giữ nguyên cây mã nguồn đã kiểm thử của commit local `2d9421a`.
- Kiểm tra 69 file trước khi publish: không có file env thật được theo dõi, không phát hiện giá trị secret backend/service trong mã nguồn được commit.
- Kiểm tra schema Supabase thật sau khi publish: truy vấn `id,user_id` vẫn trả `400 / 42703`. Cần chạy migration 002 trước khi nghiệm thu task riêng.
- Vercel, Render, Supabase đã được hệ thống xác nhận cài đặt. Người dùng đã kiểm tra team/workspace `Rannn` và Supabase `ACTIVE_HEALTHY` ở phiên khác; công cụ của ba dịch vụ chưa được nạp vào phiên triển khai local hiện tại.
- Hướng dẫn tiếp tục bằng phiên có công cụ cloud nằm trong [DEPLOYMENT_HANDOFF.md](DEPLOYMENT_HANDOFF.md).

## Cập nhật khi chạy local với Supabase thật

- Frontend đang chạy ở `http://localhost:3000`, backend ở `http://localhost:5000`; worker đã khởi động và gọi backend mỗi 60 giây.
- URL project Supabase đã cấu hình; server key nằm trong file backend `.env.development` bị ignore, không đưa vào frontend hoặc log.
- Bảng `tasks` đã được tạo trong lúc triển khai; worker thật đã có log `pending_tasks_checked` với `pending_count: 0`. Trước đó worker xử lý `HTTP_503` và tiếp tục polling khi bảng chưa tồn tại.
- Kiểm tra schema mới nhất bằng server key: truy vấn `id,user_id` trả `400 / 42703`, cột `user_id` chưa tồn tại. Cần migration 002 để task thuộc từng tài khoản.
- `/health` trả 200. Task API và `/auth/me` không có token trả `401 LOGIN_REQUIRED`.
- Backend có Auth đã được khởi động lại. Đã gọi endpoint login với tài khoản giả không tồn tại: Supabase thật trả lỗi đăng nhập, API trả `401 AUTH_FAILED` đã chuẩn hóa. Không gửi email, không tạo tài khoản thử trong project thật.
- Supabase Auth settings đã kiểm tra qua HTTP thật: Email bật, đăng ký được cho phép, tự xác nhận email tắt (cần xác nhận email). Chưa xác minh Site URL/Redirect URLs hoặc việc gửi thư.
- Project hiện tại chỉ cần chạy migration **002_task_accounts.sql** trong Supabase SQL Editor; database mới cần 001 rồi 002. Sau đó kiểm tra tài khoản và lưu/đọc/complete task thật. Server key của Data API không thay thế quyền chạy DDL SQL qua Management API hoặc kết nối PostgreSQL.

## Đã kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| `npm run build` | Đạt cho backend, service và frontend; Next.js 16.3.8 production standalone |
| `npm run typecheck` | Đạt cả ba app, gồm source và test TypeScript |
| `npm run lint` | Đạt cả ba app |
| `npm run test` | Exit code 0: 56 backend + 9 worker + 42 frontend = **107 test đạt** sau khi bổ sung tài khoản |
| UI | Playwright Chromium: mobile 375×812, tablet 768×1024, desktop 1440×1000 |
| Dependencies | Phiên bản trực tiếp được pin chính xác và khớp lockfile; npm install/audit báo 0 vulnerabilities ở cả ba app |
| Lockfile install | `npm ci --dry-run --ignore-scripts --offline --no-audit --no-fund` đạt ở cả ba app sau khi bỏ metadata package local thừa; không thay thế kiểm tra Linux Docker |
| YAML | Parse thành công: Compose có 3 service, Render có web + worker; chưa phải kiểm tra bằng Docker/Render |
| Giới hạn secret | Frontend source không có Supabase/service key; worker chỉ có backend URL và service key; file env thật được ignore |

Backend test sử dụng database mock; frontend test intercept API; worker test mock HTTP. Những kết quả này không chứng minh kết nối Supabase thật.

Smoke test bản ban đầu trên port `5051` đã dừng. Bản hiện tại chạy **`backend/dist/index.js`** trên port `5000`, bind `0.0.0.0`:

- `/health` → `200 {"status":"ok"}`.
- Internal API không key → `401`.
- Task API không token → `401 LOGIN_REQUIRED`; `/auth/me` không token cũng trả `401`.
- Login tài khoản không tồn tại → `401 AUTH_FAILED`, lỗi không lộ credentials.
- Worker gọi internal API bằng key đúng và đã nhận danh sách pending thành công sau khi bảng được tạo.

Smoke test worker ban đầu dùng key giả/loopback, đã dừng. Worker local hiện tại dùng env thật, gọi backend và có log `pending_tasks_checked` với count 0; cũng tự phục hồi sau khi backend được khởi động lại. Polling, timeout và shutdown được kiểm tra bằng 9 test worker.

Frontend đã chạy production standalone local trong các test Playwright. Test có đăng ký với/không có xác nhận email, mật khẩu nhập lại chưa khớp, đăng nhập sai rồi thử lại, giữ phiên khi reload, đăng xuất, refresh/hết hạn phiên, lỗi mạng và đổi tài khoản khi mutation cũ chưa hoàn tất. Test task có thêm/hoàn thành, loading/error/retry, giữ input/trạng thái khi lỗi và không tràn ngang với nội dung dài.

Backend test xác minh Bearer token bằng Auth mock, truyền user ID đã xác thực vào mọi thao tác task, từ chối payload giả mạo chủ sở hữu, và kiểm tra owner filter trên cả GET/PATCH qua Supabase HTTP mock. Task không thuộc owner/missing trả `404` trước khi update. Internal API vẫn dùng service key độc lập để tổng hợp pending.

Playwright trong sandbox Windows từng kẹt ở bước dọn process. Lần nghiệm thu cuối chạy ngoài sandbox và kết thúc bình thường với 42 test UI đạt. Các test khác cũng đạt trong lần chạy tổng hợp đó.

## Chưa xác minh

- Đã thử `docker compose config --quiet` và `docker compose up --build`: máy không tìm thấy executable `docker`. Chưa build/chạy ba image bằng Docker.
- Supabase thật đã đọc bảng `tasks` qua internal API thành công. Chưa chạy migration tài khoản 002; chưa nghiệm thu ghi/lưu trữ task riêng, RLS hoặc timestamp bằng database thật.
- Chưa nghiệm thu đăng ký/gửi thư xác nhận/đăng nhập thành công và phân quyền giữa hai tài khoản trên Supabase thật. Auth/UI/owner filter đã có test mock; kiểm tra live mới chỉ gồm từ chối đăng nhập sai và chặn request thiếu token.
- `render.yaml` đã đối chiếu tài liệu chính thức về monorepo, environment và plan `0.5c-512mb`; chưa validate/sync trên tài khoản Render.
- Đã public source trên GitHub; cần xác minh lại khi thêm secret/config ở các bước cloud tiếp theo.
- Chưa deploy Render/Vercel và chưa kiểm tra CORS giữa các domain cloud.

Các bước còn lại và biến môi trường có trong [README](README.md).

## Deployment checklist

- [x] Next.js chạy local — production standalone ở port 3000; UI có test Playwright
- [x] Node.js Backend chạy local — port 5000, health đạt, đọc pending từ Supabase thật thành công
- [x] Background Service chạy — polling thành công count 0, phục hồi sau khi restart backend
- [x] Đăng ký/đăng nhập/đăng xuất, phiên đăng nhập và task riêng — mã nguồn + test mock đạt
- [ ] Đăng ký/xác nhận email/đăng nhập và task riêng với Supabase thật — kiểm tra sau migration/cấu hình Auth
- [ ] Docker Compose chạy được — chưa có Docker
- [x] Supabase kết nối/đọc pending — đạt với bảng hiện có
- [ ] Supabase đọc/ghi task riêng được — còn thiếu migration tài khoản 002
- [ ] Backend deploy Render — bạn thực hiện
- [ ] Service deploy Render — bạn thực hiện
- [ ] Frontend deploy Vercel — bạn thực hiện
- [ ] Vercel gọi được Render API — kiểm tra sau deploy
- [x] Không có secret trong source đã push lên GitHub — file env thật được ignore, kiểm tra source và cây mã nguồn trước push đạt
