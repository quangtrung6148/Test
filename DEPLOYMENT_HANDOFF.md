# Tiếp tục deployment Mini Task App — phương án $0

App **đã deploy** tại https://nhip-mini-task.vercel.app. Backend: https://mini-task-api-x7qg.onrender.com. Repo: https://github.com/quangtrung6148/Test, nhánh main. Không tạo lại tài nguyên đã có.

## Trạng thái đã xác minh

- Vercel team Rannn: Hobby active. Project nhip-mini-task, ID `prj_MNl9zNdniMx0RTPUdIXmC8xIwkcP`, Node.js 22.x; deployment `dpl_6TVjqhuXch9RpeP8fXAMTSfDscQH` READY, URL public 200.
- Render workspace Rannn (`tea-davrdje7bikc73f64i1g`): service mini-task-api (`srv-davtlu1srm7s73dbejbg`), plan free, Singapore, Docker root backend; deployment `dep-davtlupsrm7s73dbemjg` live, health 200.
- Source đã nghiệm thu: commit `827d275f14355863298455b92097ddf782f33581`. Git integration/auto-deploy đã nối repository.
- Supabase giữ nguyên project `pafbhhlogzhqlgwennih`. Cột user_id đã tồn tại, không chạy lại migration 001/002. Metadata SQL đầy đủ chưa xác minh.
- Browser cloud thật đạt đăng nhập/đăng xuất, thêm/complete/reload, owner isolation, mobile/tablet/desktop. Dữ liệu thử đã dọn sạch, không gửi email. Build/typecheck/lint và 107 test trước deployment đạt.
- Backend FRONTEND_URL đã là origin Vercel; NEXT_PUBLIC_API_URL frontend là URL Render. CORS đạt. Server key chỉ ở backend.
- Render CLI đã validate Blueprint thành công. Source và artifacts/credentials được ignore, không có key thật được commit.

## Phần cần tiếp tục

1. Hoàn tất Supabase CLI login đang chờ verification code từ người dùng. Data API server key không thay thế quyền Supabase Management.
2. Đọc cấu hình Auth hiện tại, sửa Site URL về `https://nhip-mini-task.vercel.app`, thêm origin này vào Redirect URLs và giữ các entry khác cần thiết. Không thay provider, SMTP hoặc tắt xác nhận email. Hiện Admin generateLink yêu cầu URL Vercel nhưng vẫn nhận redirect về localhost.
3. Kiểm tra link xác nhận tạo bằng Admin API quay về URL production; dọn tài khoản thử. Gửi/nhận thư thực tế cần đánh dấu riêng nếu chưa kiểm tra.
4. Cập nhật README/VERIFICATION theo kết quả. Nếu push Git kích hoạt deployment mới, kiểm tra deployment live/READY và URL public; không tạo thêm service/project.

Tài khoản đã xác nhận email có thể dùng website hiện tại. Không báo luồng email xác nhận hoàn chỉnh khi redirect còn localhost.

## Ràng buộc $0

- Chỉ Vercel Hobby + một Render Free backend + Supabase hiện tại. Người dùng xác nhận Render chưa thêm phương thức thanh toán; không yêu cầu thêm thẻ.
- Không nâng gói, mua domain/add-on, tạo worker, cron, disk, Redis, database Render hoặc preview stack. Tier/billing Supabase chưa được xác minh qua Management API; không thay đổi project/gói.
- Không thêm job ping giữ Render thức. Free service ngủ sau 15 phút; đợi khởi động lại và thử lại nếu request đầu chậm.
- Worker vẫn có source và chạy local; không cần log worker cloud. Docker Compose local chưa kiểm tra vì chưa có Docker executable; Docker backend Render đã chạy thật.

## Secret và vận hành

Secret nằm trong ignored backend env và platform environment; CLI credentials và kết quả kiểm tra nằm trong ignored artifacts. Không commit, in ra chat/log hoặc đưa server key vào frontend. Git local ở `F:\Test`, origin `https://github.com/quangtrung6148/Test.git`; Windows ADMIN dùng `git -c safe.directory=F:/Test`. Không force push.

Dashboard Supabase Auth: https://supabase.com/dashboard/project/pafbhhlogzhqlgwennih/auth/url-configuration. README và VERIFICATION ghi URL live và bằng chứng kiểm tra thực tế.
