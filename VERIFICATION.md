# Báo cáo kiểm tra — 02/10/2026

Triển khai tại `F:\Test` bằng Node.js `22.14.0`, npm `10.9.2`. Đã bổ sung đăng ký/đăng nhập/đăng xuất bằng Supabase Auth và task riêng cho từng tài khoản theo yêu cầu cập nhật. Mã nguồn đã public tại [quangtrung6148/Test](https://github.com/quangtrung6148/Test); chưa deploy cloud.

## Cập nhật khi bắt đầu deployment

- Yêu cầu mới: chỉ dùng Vercel Hobby + Render Free backend + Supabase hiện tại; không tạo tài nguyên trả phí, không deploy worker production.
- `render.yaml` đã đổi thành một Web Service `mini-task-api`, `plan: free`, tắt Blueprint previews; đã bỏ khai báo worker và mọi plan trả phí. `frontend/vercel.json` cố định framework/build/install; Node 22 được giới hạn trong package.json và cần chọn 22.x trên Vercel.
- Chưa tạo tài nguyên cloud. Kiểm tra phiên hiện tại: không có công cụ Supabase/Render/Vercel gọi được, không có CLI đã cài/đăng nhập hoặc token platform trong environment. GitHub vẫn có quyền truy cập/push.
- Chưa xác minh billing/usage của tài khoản. Render Free có thể phát sinh phí vượt quota nếu workspace đã có phương thức thanh toán; cần xác minh điều kiện $0 trước khi Apply, không nâng gói hoặc bật add-on.
- Kiểm tra Supabase mới trong lượt chuyển sang $0: truy vấn `id,user_id` trả `200`, không có lỗi, đọc được một hàng. Cột `user_id` đã có; không cần chạy lại migration 002. Chưa kiểm tra metadata constraint/index bằng quyền SQL.
- Validation mới: `render.yaml` đạt toàn bộ JSON Schema Render draft 2020-12; xác minh đúng một Web Service `plan: free`, previews `off`, không có database/worker. Các field đang dùng trong `frontend/vercel.json` đạt kiểm tra theo định nghĩa schema Vercel chính thức. Schema Vercel đầy đủ trộn cú pháp draft-04 và mới hơn trong các tính năng không dùng; chỉ kiểm tra các field cấu hình đã chọn, không coi đây là validation trên tài khoản cloud.
- Smoke test backend local với Supabase thật đạt bằng hai tài khoản thử được tạo với email đã xác nhận qua Admin API: đăng nhập, tạo/list/đọc lại task, phân quyền giữa hai tài khoản (PATCH khác owner 404), complete lặp giữ timestamp, record database đúng owner/trạng thái, không token 401 và đăng xuất. Tài khoản thử và task đã xóa; không gửi email. Đây là kiểm tra API local + database thật, chưa thay thế nghiệm thu browser/cloud hoặc gửi thư đăng ký.

- Đã push mã nguồn lên nhánh `main`, commit `57ce76c`; hợp nhất commit khởi tạo `README.md` của repository và giữ nguyên cây mã nguồn đã kiểm thử của commit local `2d9421a`.
- Kiểm tra 69 file trước khi publish: không có file env thật được theo dõi, không phát hiện giá trị secret backend/service trong mã nguồn được commit.
- Kiểm tra schema Supabase sau lần publish đầu trả `400 / 42703`; lần kiểm tra mới khi chuyển sang $0 đã trả `200`, cột `user_id` hiện có.
- Vercel, Render, Supabase đã được hệ thống xác nhận cài đặt. Người dùng đã kiểm tra team/workspace `Rannn` và Supabase `ACTIVE_HEALTHY` ở phiên khác; công cụ của ba dịch vụ chưa được nạp vào phiên triển khai local hiện tại.
- Hướng dẫn tiếp tục bằng phiên có công cụ cloud nằm trong [DEPLOYMENT_HANDOFF.md](DEPLOYMENT_HANDOFF.md).

## Cập nhật khi chạy local với Supabase thật

- Frontend đang chạy ở `http://localhost:3000`, backend ở `http://localhost:5000`; worker đã khởi động và gọi backend mỗi 60 giây.
- URL project Supabase đã cấu hình; server key nằm trong file backend `.env.development` bị ignore, không đưa vào frontend hoặc log.
- Bảng `tasks` đã được tạo trong lúc triển khai; worker thật đã có log `pending_tasks_checked` với `pending_count: 0`. Trước đó worker xử lý `HTTP_503` và tiếp tục polling khi bảng chưa tồn tại.
- Kiểm tra schema trước đây bằng server key trả `400 / 42703`; kiểm tra mới khi chuyển sang $0 trả `200`, cột `user_id` hiện có.
- `/health` trả 200. Task API và `/auth/me` không có token trả `401 LOGIN_REQUIRED`.
- Backend có Auth đã được khởi động lại. Đã gọi endpoint login với tài khoản giả không tồn tại: Supabase thật trả lỗi đăng nhập, API trả `401 AUTH_FAILED` đã chuẩn hóa. Không gửi email, không tạo tài khoản thử trong project thật.
- Supabase Auth settings đã kiểm tra qua HTTP thật: Email bật, đăng ký được cho phép, tự xác nhận email tắt (cần xác nhận email). Chưa xác minh Site URL/Redirect URLs hoặc việc gửi thư.
- Project hiện tại đã có cột `user_id`; không chạy lại migration 002. Database mới cần 001 rồi 002. Còn cần nghiệm thu tài khoản và lưu/đọc/complete task thật. Server key của Data API không thay thế quyền chạy DDL SQL qua Management API hoặc kết nối PostgreSQL.

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
| Cấu hình cloud $0 | Render JSON Schema đạt: một web Free, previews off. Field Vercel framework/install/build đạt theo schema chính thức; chưa sync/deploy cloud |
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
- Supabase thật đã đạt luồng task cá nhân/owner/timestamp qua backend local. Chưa kiểm tra đầy đủ metadata FK/constraint/index, RLS/grants bằng SQL; cleanup task khi xóa tài khoản thử đã xác minh cascade hoạt động.
- Chưa nghiệm thu đăng ký/gửi thư xác nhận và browser với tài khoản thật. Đăng nhập/đăng xuất và phân quyền hai tài khoản thử với Supabase thật đã đạt qua backend local; tài khoản thử dùng Admin API xác nhận email sẵn, không kiểm tra đường gửi email đăng ký.
- `render.yaml` đã đối chiếu tài liệu chính thức về monorepo, environment và `plan: free`; chưa validate/sync trên tài khoản Render hoặc xác minh billing workspace.
- Đã public source trên GitHub; cần xác minh lại khi thêm secret/config ở các bước cloud tiếp theo.
- Chưa deploy Render/Vercel và chưa kiểm tra CORS giữa các domain cloud.

Các bước còn lại và biến môi trường có trong [README](README.md).

## Deployment checklist

- [x] Next.js chạy local — production standalone ở port 3000; UI có test Playwright
- [x] Node.js Backend chạy local — port 5000, health đạt, đọc pending từ Supabase thật thành công
- [x] Background Service chạy — polling thành công count 0, phục hồi sau khi restart backend
- [x] Đăng ký/đăng nhập/đăng xuất, phiên đăng nhập và task riêng — mã nguồn + test mock đạt
- [x] Đăng nhập/đăng xuất và task riêng qua backend local + Supabase thật — hai tài khoản thử, đã cleanup
- [ ] Đăng ký/xác nhận email và browser với Supabase thật — chưa xác minh gửi thư
- [ ] Docker Compose chạy được — chưa có Docker
- [x] Supabase kết nối/đọc pending — đạt với bảng hiện có
- [x] Supabase đọc/ghi task riêng được — tạo/đọc/complete, owner isolation và timestamp qua API local đạt
- [ ] Billing/usage đáp ứng $0 — chưa có quyền đọc trạng thái tài khoản trong phiên này
- [ ] Backend deploy Render Free — chưa xác minh
- [x] Worker production bỏ khỏi Blueprint theo yêu cầu; worker local vẫn giữ nguyên
- [ ] Frontend deploy Vercel Hobby — chưa xác minh
- [ ] Vercel gọi được Render API — kiểm tra sau deploy
- [x] Không có secret trong source đã push lên GitHub — file env thật được ignore, kiểm tra source và cây mã nguồn trước push đạt
