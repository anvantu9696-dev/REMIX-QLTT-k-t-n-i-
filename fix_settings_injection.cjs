const fs = require('fs');
let content = fs.readFileSync('src/pages/SettingsPage.tsx', 'utf8');

const injectPoint = "export const SettingsPage: React.FC = () => {";
const mappingCode = `
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị viên (Admin)',
  MANAGER: 'Quản lý / Trưởng phòng',
  SHIFT_LEADER: 'Trưởng ca / Phó ca',
  STAFF: 'Nhân viên vận hành',
  VIEWER: 'Khách / Xem dữ liệu'
};

const getRolePermissions = (roles: string[]) => {
  if (roles.includes('ADMIN')) {
    return {
      allowed: ['Toàn quyền kiểm soát hệ thống', 'Quản trị người dùng & phân quyền', 'Thêm/sửa/xóa Trạm, Tuyến, Thiết bị', 'Quản lý Công việc & Mẫu Checklist', 'Phê duyệt mọi tác vụ', 'Import/Export & Reset dữ liệu'],
      denied: []
    };
  }
  if (roles.includes('MANAGER')) {
    return {
      allowed: ['Quản lý Trạm, Phát tuyến, Thiết bị', 'Giao/tạo/sửa/xóa công việc', 'Quản lý Mẫu Checklist', 'Phê duyệt thay đổi', 'Xem báo cáo & Audit Log'],
      denied: ['Quản lý tài khoản và phân quyền', 'Import/Export dữ liệu hệ thống', 'Reset dữ liệu toàn cục']
    };
  }
  if (roles.includes('SHIFT_LEADER')) {
    return {
      allowed: ['Xem dữ liệu Trạm, Tuyến, Thiết bị', 'Cập nhật trạng thái khẩn cấp', 'Xem báo cáo', 'Theo dõi Audit Log'],
      denied: ['Không được giao/tạo/sửa công việc', 'Không được sửa mẫu checklist', 'Không quản lý tài khoản/role', 'Không Import/Reset dữ liệu']
    };
  }
  if (roles.includes('STAFF')) {
    return {
      allowed: ['Xem Trạm 110kV', 'Xem Phát tuyến', 'Xem Thiết bị', 'Xem công việc được giao', 'Thực hiện checklist được giao', 'Cập nhật kết quả kiểm tra'],
      denied: ['Giao/tạo/sửa/xóa công việc', 'Tạo/sửa/xóa mẫu checklist', 'Quản lý tài khoản và phân quyền', 'Import dữ liệu quản trị', 'Phê duyệt nghiệp vụ']
    };
  }
  
  return {
    allowed: ['Xem dữ liệu danh mục', 'Đọc tài liệu hướng dẫn', 'Giao diện Read-only'],
    denied: ['Mọi thao tác Thêm, Sửa, Xóa', 'Không được thực hiện công việc', 'Không đổi mật khẩu/cập nhật thông tin', 'Không truy cập Settings nâng cao']
  };
};

export const SettingsPage: React.FC = () => {`;

content = content.replace(injectPoint, mappingCode);

fs.writeFileSync('src/pages/SettingsPage.tsx', content);
