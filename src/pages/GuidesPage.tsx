import React, { useState } from 'react';
import {
  BookOpen, Users, Shield, Zap, Search, Layers, ChevronRight,
  FileSpreadsheet, MapPin, CheckCircle2, AlertTriangle, FileText,
  Key, Cpu, Wrench, Eye, HelpCircle
} from 'lucide-react';

export const GuidesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SYSTEM_GUIDE' | 'ROLE_GUIDE'>('SYSTEM_GUIDE');
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'PHUONG_THUC' | 'TRUONG_CA' | 'DOI_TRUONG' | 'VAN_HANH' | 'GUEST'>('ADMIN');
  const [searchTerm, setSearchTerm] = useState('');

  const systemGuides = [
    {
      id: 'g1',
      title: '1. Đăng Nhập & Phân Quyền Hạn RBAC',
      icon: <Key className="w-5 h-5 text-sky-600" />,
      category: 'Tài Khoản',
      summary: 'Quy trình xác thực người dùng bằng JWT, vai trò người dùng và phân vùng dữ liệu (Scope).',
      content: `Hệ thống hỗ trợ cơ chế RBAC (Role-Based Access Control) đa tầng với 6 nhóm quyền chính: ADMIN, CÁN BỘ PHƯƠNG THỨC, TRƯỞNG CA/PHÓ CA, ĐỘI TRƯỞNG, NHÂN VIÊN VẬN HÀNH, KHÁCH.
- Tự động khóa tài khoản sau 5 lần nhập sai mật khẩu.
- Phân vùng dữ liệu (Scope) áp dụng theo Đơn vị, Đội vận hành, Trạm 110kV và Phát tuyến.`
    },
    {
      id: 'g2',
      title: '2. Quản Lý Thiết Bị Lưới Điện (LBS, Recloser, DS, RMU)',
      icon: <Cpu className="w-5 h-5 text-sky-600" />,
      category: 'Thiết Bị',
      summary: 'Tra cứu, tạo mới, chỉnh sửa thông số kỹ thuật, tọa độ GPS và hình ảnh hiện trường.',
      content: `Mỗi thiết bị được định danh bằng DEVICE_ID duy nhất (Ví dụ: LBS-001, REC-002).
- Hỗ trợ lưu trữ số trụ, tuyến đường, phát tuyến trực thuộc, trạng thái vận hành.
- Lưu vết lịch sử thay đổi vị trí GPS và lịch sử thay đổi trạng thái thiết bị.`
    },
    {
      id: 'g3',
      title: '3. Bản Đồ Bản Đồ GIS & Định Vi Tọa Độ GPS',
      icon: <MapPin className="w-5 h-5 text-sky-600" />,
      category: 'GIS',
      summary: 'Trực quan hóa vị trí trạm 110kV và thiết bị trên bản đồ Google Maps tích hợp.',
      content: `Bản đồ tương tác thời gian thực cho phép:
- Định vị tự động bằng GPS hiện tại của nhân viên vận hành hiện trường.
- Mở chỉ đường trực tiếp tới vị trí trụ/thiết bị qua Google Maps.
- Phân màu biểu tượng thiết bị theo trạng thái vận hành và loại thiết bị.`
    },
    {
      id: 'g4',
      title: '4. Quản Lý Mạch Khép Vòng & Sơ Đồ Topology',
      icon: <Layers className="w-5 h-5 text-sky-600" />,
      category: 'Topology',
      summary: 'Thiết kế sơ đồ liên kết giữa Trạm A - Tuyến A - Thiết bị liên lạc - Tuyến B - Trạm B.',
      content: `Chức năng quản lý mạch khép vòng giúp cán bộ phương thức:
- Tạo mới và chỉnh sửa sơ đồ liên kết đường dây.
- Quản lý các phiên bản Topology (v1.0, v1.1, v2.0) với đầy đủ lưu vết thay đổi.
- Hiển thị trạng thái Rơle 79 và trạng thái giám sát SCADA (Chỉ đọc).`
    },
    {
      id: 'g5',
      title: '5. Quy Trình Phê Duyệt Phương Thức Chuyển Tải',
      icon: <Shield className="w-5 h-5 text-sky-600" />,
      category: 'Phê Duyệt',
      summary: 'Luồng phê duyệt 2 bước giữa Cán bộ Phương thức và Lãnh đạo/Trưởng ca.',
      content: `Mọi thay đổi sơ đồ Topology phải trải qua quy trình trình duyệt nghiêm ngặt:
- Trình duyệt: Cán bộ phương thức lập yêu cầu + tóm tắt lý do thay đổi.
- Phê duyệt: Trưởng phòng Điều độ / Trưởng ca duyệt hoặc từ chối kèm lý do.
- Tự động ghi nhật ký Audit Log mọi quyết định phê duyệt.`
    },
    {
      id: 'g6',
      title: '6. Giao Việc & Phiếu Công Tác Hiện Trường',
      icon: <Wrench className="w-5 h-5 text-sky-600" />,
      category: 'Công Việc',
      summary: 'Phân công nhiệm vụ kiểm tra, sửa chữa, bảo dưỡng thiết bị lưới điện.',
      content: `Đội trưởng hoặc Trưởng ca có quyền giao việc trực tiếp:
- Thông tin: Tên công việc, Thiết bị, Người thực hiện, Đội, Checklist đính kèm, Ngày giao, Hạn hoàn thành.
- Quản lý trạng thái công việc: NEW, ASSIGNED, ACCEPTED, IN_PROGRESS, COMPLETED, OVERDUE, RETURNED, CANCELLED.`
    },
    {
      id: 'g7',
      title: '7. Checklist Kiểm Tra Định Kỳ',
      icon: <CheckCircle2 className="w-5 h-5 text-sky-600" />,
      category: 'Kiểm Tra',
      summary: 'Thực hiện kiểm tra hiện trường theo các mẫu hạng mục đạt/không đạt.',
      content: `Nhân viên vận hành sử dụng ứng dụng di động/máy tính để thực hiện checklist:
- Đánh giá đạt / không đạt từng hạng mục thiết bị.
- Chụp ảnh minh chứng tại hiện trường.
- Tự động phát hiện khiếm khuyết và gợi ý tạo Báo cáo Bất thường.`
    },
    {
      id: 'g8',
      title: '8. Báo Cáo Bất Thường & Khiếm Khuyết',
      icon: <AlertTriangle className="w-5 h-5 text-sky-600" />,
      category: 'Bất Thường',
      summary: 'Ghi nhận sự cố, điểm chập cháy, phát nhiệt hoặc hư hỏng thiết bị.',
      content: `Khi phát hiện sự cố nguy hiểm trên lưới điện:
- Lập báo cáo bất thường kèm mức độ nghiêm trọng: LOW, MEDIUM, HIGH, CRITICAL.
- Phân công cán bộ xử lý khẩn cấp và theo dõi tiến độ khắc phục.`
    },
    {
      id: 'g9',
      title: '9. Quy Trình Import File Excel / CSV 5 Bước',
      icon: <FileSpreadsheet className="w-5 h-5 text-sky-600" />,
      category: 'Import',
      summary: 'Quy trình nhập dữ liệu chống trùng và giải quyết xung đột vắn đáp.',
      content: `Chức năng Import tuân thủ chặt chẽ 5 bước:
1. UPLOAD: Tải file .xlsx / .csv.
2. VALIDATE & MAPPING: Kiểm tra cú pháp và ánh xạ cột.
3. DUPLICATE & CONFLICT CHECK: Phát hiện trùng DEVICE_ID nội bộ và xung đột với DB.
4. PREVIEW & CONFIRM: Lựa chọn giữ cũ, cập nhật hoặc bỏ qua.
5. TRANSACTION & AUDIT: Ghi dữ liệu vào DB theo giao dịch an toàn (Rollback nếu lỗi).`
    },
    {
      id: 'g10',
      title: '10. Báo Cáo & Xuất Dữ Liệu Excel/PDF Topology',
      icon: <FileText className="w-5 h-5 text-sky-600" />,
      category: 'Báo Cáo',
      summary: 'Xuất danh sách thiết bị, công việc, và In Báo Cáo Khép Vòng chuẩn.',
      content: `Trung tâm báo cáo cho phép xuất Excel/CSV toàn bộ phân hệ và In Báo Cáo Khép Vòng Topology thiết kế đúng chuẩn quy định ngành điện.`
    }
  ];

  const roleGuides = {
    ADMIN: {
      title: 'Hướng Dẫn Dành Cho Quản Trị Hệ Thống (ADMIN)',
      badge: 'Level 1 - Toàn Quyền',
      color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
      tasks: [
        'Quản lý danh sách người dùng, cấp phát tài khoản và khóa tài khoản vi phạm.',
        'Cấu hình Vai trò & Phân quyền (RBAC) chi tiết cho từng nhóm phòng ban.',
        'Tra cứu và xuất nhật ký Audit Log chi tiết để kiểm tra an ninh hệ thống.',
        'Thực hiện Import dữ liệu thiết bị từ Excel và theo dõi kết quả xử lý xung đột.',
        'Thực hiện Sao lưu (Backup) và Khôi phục (Restore) cơ sở dữ liệu SQLite.'
      ]
    },
    PHUONG_THUC: {
      title: 'Hướng Dẫn Dành Cho Cán Bộ Phương Thức',
      badge: 'Level 2 - Quản Lý Topology',
      color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
      tasks: [
        'Lập sơ đồ phương thức khép vòng liên kết giữa các Trạm 110kV và Phát tuyến.',
        'Quản lý cây sơ đồ Topology, thêm bớt nút (Node) và liên kết dây (Edge).',
        'Tạo yêu cầu trình duyệt phương thức chuyển tải mới (v1.0 -> v2.0).',
        'Theo dõi trạng thái phê duyệt từ Trưởng phòng / Trưởng ca điều độ.'
      ]
    },
    TRUONG_CA: {
      title: 'Hướng Dẫn Dành Cho Trưởng Ca / Phó Ca Điều Độ',
      badge: 'Level 3 - Điều Hành Ca',
      color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900',
      tasks: [
        'Giám sát trạng thái vận hành toàn lưới điện thời gian thực trên Dashboard.',
        'Xem trạng thái tín hiệu SCADA (Chỉ đọc - Không có lệnh điều khiển).',
        'Phê duyệt hoặc từ chối các yêu cầu thay đổi sơ đồ Topology từ cán bộ phương thức.',
        'Giao việc khẩn cấp cho các Đội vận hành xử lý khi phát sinh sự cố.'
      ]
    },
    DOI_TRUONG: {
      title: 'Hướng Dẫn Dành Cho Đội Trưởng / Trưởng Nhóm Vận Hành',
      badge: 'Level 4 - Giao Việc & Lịch',
      color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
      tasks: [
        'Phân công công việc kiểm tra hiện trường cho các nhân viên vận hành.',
        'Lập lịch kiểm tra định kỳ hàng ngày, hàng tuần, hàng tháng cho các tuyến thiết bị.',
        'Kiểm tra kết quả thực hiện checklist và duyệt hoàn thành công việc.',
        'Theo dõi và phân công xử lý các báo cáo Bất thường / Khiếm khuyết.'
      ]
    },
    VAN_HANH: {
      title: 'Hướng Dẫn Dành Cho Nhân Viên Vận Hành Trực Tiếp',
      badge: 'Level 5 - Thực Hiện Hiện Trường',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
      tasks: [
        'Tiếp nhận phiếu giao việc trên điện thoại / máy tính.',
        'Chuyển trạng thái công việc: ACCEPTED -> IN_PROGRESS -> COMPLETED.',
        'Thực hiện nhập kết quả Checklist kiểm tra thiết bị hiện trường.',
        'Báo cáo bất thường / sự cố khi phát hiện hư hỏng kèm hình ảnh chụp thực tế.'
      ]
    },
    GUEST: {
      title: 'Hướng Dẫn Dành Cho Quyền Xem (KHÁCH / GUEST)',
      badge: 'Level 6 - Chỉ Xem',
      color: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      tasks: [
        'Tra cứu danh sách Trạm, Phát tuyến, Thiết bị và vị trí trên bản đồ GIS.',
        'Xem sơ đồ mạch khép vòng Topology công khai.',
        'Tuyệt đối không có quyền Thêm, Sửa, Xóa hoặc Phê duyệt bất kỳ dữ liệu nào.'
      ]
    }
  };

  const filteredGuides = systemGuides.filter(g => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return g.title.toLowerCase().includes(term) || g.content.toLowerCase().includes(term) || g.category.toLowerCase().includes(term);
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-sky-600 dark:text-sky-400" />
            Trung Tâm Hướng Dẫn & Tài Liệu Vận Hành
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Cẩm nang hướng dẫn sử dụng hệ thống toàn diện cho từng vai trò người dùng
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('SYSTEM_GUIDE')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'SYSTEM_GUIDE'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Hướng Dẫn Chức Năng
          </button>
          <button
            onClick={() => setActiveTab('ROLE_GUIDE')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'ROLE_GUIDE'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Hướng Dẫn Theo Role
          </button>
        </div>
      </div>

      {/* SYSTEM FUNCTION GUIDES TAB */}
      {activeTab === 'SYSTEM_GUIDE' && (
        <div className="space-y-6">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm chủ đề hướng dẫn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGuides.map((guide) => (
              <div
                key={guide.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 hover:border-sky-300 dark:hover:border-sky-800 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-sky-50 dark:bg-sky-950/60 rounded-xl">
                      {guide.icon}
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{guide.title}</h3>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold rounded-full">
                    {guide.category}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {guide.summary}
                </p>

                <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line border border-slate-100 dark:border-slate-800/80">
                  {guide.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ROLE-BASED GUIDES TAB */}
      {activeTab === 'ROLE_GUIDE' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-semibold">
            {[
              { id: 'ADMIN', label: 'Quản Trị Viên (ADMIN)' },
              { id: 'PHUONG_THUC', label: 'Cán Bộ Phương Thức' },
              { id: 'TRUONG_CA', label: 'Trưởng Ca / Phó Ca' },
              { id: 'DOI_TRUONG', label: 'Đội Trưởng Vận Hành' },
              { id: 'VAN_HANH', label: 'Nhân Viên Hiện Trường' },
              { id: 'GUEST', label: 'Khách Xem (GUEST)' }
            ].map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id as any)}
                className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                  selectedRole === role.id
                    ? 'bg-sky-600 text-white shadow-md font-bold'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>

          {/* Selected Role Detail Card */}
          {roleGuides[selectedRole] && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {roleGuides[selectedRole].title}
                </h3>
                <span className={`px-3 py-1 text-xs font-bold rounded-full border ${roleGuides[selectedRole].color}`}>
                  {roleGuides[selectedRole].badge}
                </span>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  NHIỆM VỤ & QUYỀN HẠN CHÍNH TRÊN HỆ THỐNG:
                </h4>
                <div className="space-y-2">
                  {roleGuides[selectedRole].tasks.map((task, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl flex items-start gap-3 border border-slate-100 dark:border-slate-800/60">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                        {task}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
