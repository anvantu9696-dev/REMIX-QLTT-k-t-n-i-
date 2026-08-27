# ROLLBACK_PLAN.md

1. **Khi nào cần rollback:**
    - Tính năng mới gây lỗi nghiêm trọng (HTTP 500, crash app, mất dữ liệu).
    - Lỗi regression trên các tính năng quan trọng (Login, CRUD, Import).
    - Cảnh báo hệ thống tăng đột biến.

2. **Cách nhận biết release lỗi:**
    - Monitor console/network log: tăng đột biến HTTP 500/403/401.
    - Người dùng báo cáo không tải được dữ liệu, không import được.

3. **Version production ổn định gần nhất:**
    - `PRODUCTION_STABLE_V1` (Current tag).

4. **Cách deploy lại stable version:**
    - Sử dụng quy trình deployment chuẩn (re-deploy từ commit/tag `PRODUCTION_STABLE_V1`).

5. **Lưu ý quan trọng:**
    - **Không rollback Firestore data tự động.** Chỉ rollback code.
    - Nếu schema thay đổi (dù hạn chế), cần thực hiện script migrate/rollback dữ liệu tương ứng nếu cần thiết.
