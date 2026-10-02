# Báo cáo kiểm tra — 02/10/2026

App đã public source tại [quangtrung6148/Test](https://github.com/quangtrung6148/Test) và được triển khai trực tiếp theo yêu cầu $0. Người dùng đã ủy quyền deployment; agent thực hiện trên tài khoản đã đăng nhập, không tạo tài nguyên trả phí.

## Deployment đã kiểm tra

| Thành phần | Kết quả thực tế |
|---|---|
| Frontend | https://nhip-mini-task.vercel.app — public HTTP 200, deployment READY |
| Vercel | Team Rannn, API xác nhận Hobby active, project nhip-mini-task, Node.js 22.x |
| Backend | https://mini-task-api-x7qg.onrender.com — deployment live, `/health` 200 |
| Render | Workspace Rannn, service mini-task-api, API xác nhận plan free, Singapore, Docker |
| Database | Project Supabase hiện tại pafbhhlogzhqlgwennih; không tạo project mới hoặc nâng gói |
| CORS/env | Origin Vercel chính xác; preflight 204; frontend gọi HTTPS Render, server key chỉ ở backend |
| Source triển khai | `827d275f14355863298455b92097ddf782f33581`, nhánh main |
| Worker production | Bỏ theo yêu cầu; không có worker, cron, disk hoặc database Render |

Render service ID: `srv-davtlu1srm7s73dbejbg`, deployment live `dep-davtlupsrm7s73dbemjg`. Vercel project ID: `prj_MNl9zNdniMx0RTPUdIXmC8xIwkcP`, deployment READY `dpl_6TVjqhuXch9RpeP8fXAMTSfDscQH`. Các ID này ghi lại lần nghiệm thu đầu; Git auto-deploy có thể tạo deployment mới khi cập nhật tài liệu.

Người dùng xác nhận Render chưa thêm phương thức thanh toán. Không yêu cầu thêm thẻ, không nâng gói hoặc mua add-on. Tier/billing Supabase chưa được đọc qua Management API; project được giữ nguyên. Render Free có thể ngủ sau 15 phút không có request; đợi khởi động lại và thử lại khi truy cập lần đầu. Không thêm ping để giữ service thức.

## Nghiệm thu browser → API → database thật

Browser Chromium truy cập URL Vercel public, gọi backend Render thật và lưu task vào Supabase thật; không intercept hoặc mock API:

- Đăng nhập tài khoản thử đã xác nhận email qua Supabase Admin API.
- Thêm task từ UI; đọc database xác nhận đúng chủ sở hữu và trạng thái pending.
- Hoàn thành task từ UI; reload vẫn completed, database khớp trạng thái.
- Tài khoản thứ hai không thấy task của tài khoản thứ nhất; PATCH UUID của người khác trả 404, không token trả 401.
- Đăng xuất thành công; tài khoản thứ hai có danh sách riêng.
- Desktop 1440×1000, tablet 768×1024, mobile 375×812 không tràn ngang; không ghi nhận lỗi JavaScript.
- Tài khoản thử và task đã được dọn sạch; không gửi email thử.

Ảnh nghiệm thu và kết quả chạy nằm trong `artifacts/` local, được ignore. Smoke test backend local + Supabase thật trước đó cũng đạt complete lặp giữ nguyên updated_at và xóa tài khoản thử cascade xóa task.

## Build và test đã kiểm tra

Máy local: Node.js 22.14.0, npm 10.9.2. Không thay đổi mã ứng dụng kể từ lần build/test này; cập nhật sau deployment chỉ là tài liệu, ignore và region trong YAML.

| Kiểm tra | Kết quả |
|---|---|
| `npm run build` | Đạt backend, service, frontend; Next.js 16.3.8 standalone |
| `npm run typecheck` | Đạt cả ba app, gồm test TypeScript |
| `npm run lint` | Đạt cả ba app |
| `npm run test` | 56 backend + 9 worker + 42 Playwright = **107 test đạt** |
| Dependencies | Phiên bản trực tiếp pin và khớp lockfile; audit tại lần cài báo 0 vulnerabilities |
| Config | Render JSON Schema và Render CLI Blueprint validate đạt; các field Vercel đang dùng đạt schema chính thức |
| Docker backend cloud | Render đã build Dockerfile và chạy deployment live |
| Worker local | Internal API thật trả pending, log count 0; phục hồi sau restart backend; polling/timeout/shutdown có 9 test |
| Secret | Env thật, CLI credentials, dependencies và artifacts không được commit; frontend không có server/service key |

107 test sử dụng database/API mock trong test. Nghiệm thu cloud thật là lần kiểm tra riêng ở phần trên, không suy ra từ test mock.

## Chưa xác minh và phần còn lại

- **Supabase Auth URL cần sửa:** Admin generateLink được yêu cầu redirect về URL Vercel nhưng link thực tế vẫn có `redirect_to=http://localhost:3000`. Cần quyền Management/CLI để cập nhật Site URL và redirect allowlist, bảo toàn cấu hình khác. CLI login đang chờ verification code từ người dùng. Không tắt Confirm email để bỏ qua vấn đề.
- Gửi/nhận thư đăng ký thực tế chưa kiểm tra. Email provider bật, signup bật, Confirm email bật. Tài khoản thử xác nhận sẵn không chứng minh luồng gửi thư.
- Docker Compose local chưa chạy: máy chưa có executable Docker. Việc Docker backend chạy thành công trên Render không thay thế nghiệm thu cả ba container local.
- Metadata SQL đầy đủ về FK/index/constraints/RLS/grants chưa kiểm tra trực tiếp bằng quyền SQL. Cột user_id tồn tại; đọc/ghi, owner isolation, timestamp và cascade đã được kiểm tra qua API thật. Không chạy lại migration 001/002 trên project này.
- Tier/billing Supabase hiện tại chưa xác minh qua Management API; không nâng hoặc thay gói.

## Deployment checklist

- [x] Mã nguồn public GitHub, env thật được ignore
- [x] Build/typecheck/lint và 107 test
- [x] Backend Render Free live; agent thực hiện deployment
- [x] Frontend Vercel Hobby READY; agent thực hiện deployment
- [x] Browser Vercel → Render → Supabase đọc/ghi thật
- [x] Task riêng giữa tài khoản, thêm/complete/reload và đăng xuất
- [x] Mobile/tablet/desktop không tràn ngang
- [x] Không tạo worker production hoặc tài nguyên trả phí
- [ ] Supabase Auth Site URL/Redirect URLs production
- [ ] Gửi/nhận email xác nhận đăng ký
- [ ] Docker Compose local
- [ ] Metadata SQL đầy đủ và tier/billing Supabase

Hướng dẫn vận hành trong [README.md](README.md); các bước tiếp tục trong [DEPLOYMENT_HANDOFF.md](DEPLOYMENT_HANDOFF.md).
