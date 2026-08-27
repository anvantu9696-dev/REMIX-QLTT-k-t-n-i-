# DEVICE_IMAGE_FEATURE_TEMPORARY_LOCK

- **Lý do tạm khóa**: Chức năng hình ảnh hiện tại bị chặn bởi PERMISSION_DENIED (403) trên Firebase Storage/Firestore, chưa thể cấu hình quyền IAM và Billing phù hợp cho môi trường hiện tại.
- **Ngày tạm khóa**: 2026-08-26
- **Feature flags**: 
  - `DEVICE_IMAGE_FEATURE_ENABLED=false`
  - `DEVICE_IMAGE_UPLOAD_ENABLED=false`
- **API bị khóa**: Tất cả các API mutation hình ảnh (upload, camera, thêm, sửa, xóa, đặt ảnh đại diện).
- **Dữ liệu ảnh cũ**: 8 document hiện có trong `device_images` được bảo toàn, ảnh hiển thị qua URL ngoài (Unsplash) vẫn hoạt động.
- **Các bước cần làm khi mở lại**:
  1. Kiểm tra cấu hình Billing (Blaze plan).
  2. Cấp quyền IAM `roles/storage.objectUser` cho Service Account trên Storage Bucket.
  3. Bật lại `DEVICE_IMAGE_FEATURE_ENABLED` và `DEVICE_IMAGE_UPLOAD_ENABLED` trong cấu hình backend.
  4. Kiểm tra lại phân quyền Firestore rules.
