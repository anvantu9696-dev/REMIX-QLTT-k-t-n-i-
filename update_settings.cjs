const fs = require('fs');
let content = fs.readFileSync('src/pages/SettingsPage.tsx', 'utf8');

const importTarget = "import { User, LogOut, Moon, Sun, Monitor, Lock, Globe, Bell, Shield, Cloud, Download, Upload, AlertTriangle, ShieldAlert, RefreshCw, Smartphone, Key, Database, Cpu, Wifi } from 'lucide-react';";
const importReplacement = "import { User, LogOut, Moon, Sun, Monitor, Lock, Globe, Bell, Shield, Cloud, Download, Upload, AlertTriangle, ShieldAlert, RefreshCw, Smartphone, Key, Database, Cpu, Wifi, CheckCircle2, XCircle } from 'lucide-react';";

content = content.replace(importTarget, importReplacement);

// Find role mapping injection point
const injectPoint = "const SettingsPage = () => {";
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

const SettingsPage = () => {`;

content = content.replace(injectPoint, mappingCode);

const oldRoleDiv = `              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Vai trò phân quyền</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {user?.roles?.map((r: string) => (
                    <span key={r} className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono text-[10px] font-bold rounded">
                      {r}
                    </span>
                  ))}
                </div>
              </div>`;

const newRoleDiv = `              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3 col-span-1 sm:col-span-2">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Vai trò phân quyền hiện tại</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {user?.roles?.map((r: string) => (
                      <span key={r} className="px-3 py-1 bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60 text-purple-800 dark:text-purple-300 font-bold text-xs rounded-lg flex items-center space-x-1">
                        <Shield className="w-3.5 h-3.5 mr-1" />
                        <span>{r} - {ROLE_LABELS[r] || 'Không xác định'}</span>
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Bạn được phép</span>
                    </div>
                    <ul className="space-y-1.5">
                      {getRolePermissions(user?.roles || []).allowed.map((item, idx) => (
                        <li key={idx} className="flex items-start text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          <span className="text-emerald-500 mr-1.5 mt-0.5">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {getRolePermissions(user?.roles || []).denied.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-1.5 text-rose-700 dark:text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
                        <XCircle className="w-4 h-4" />
                        <span>Bạn không được phép</span>
                      </div>
                      <ul className="space-y-1.5">
                        {getRolePermissions(user?.roles || []).denied.map((item, idx) => (
                          <li key={idx} className="flex items-start text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            <span className="text-rose-500 mr-1.5 mt-0.5">✕</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>`;

content = content.replace(oldRoleDiv, newRoleDiv);

fs.writeFileSync('src/pages/SettingsPage.tsx', content);
