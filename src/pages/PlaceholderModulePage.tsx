import React from 'react';
import { Layers, ShieldCheck, Eye, ArrowRight, Construction, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PlaceholderModulePageProps {
  title: string;
  moduleCode: string;
  description: string;
}

export const PlaceholderModulePage: React.FC<PlaceholderModulePageProps> = ({
  title,
  moduleCode,
  description
}) => {
  const { user, isGuest } = useAuth();

  return (
    <div className="space-y-6 text-xs">
      {/* Module Title Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-bold mb-2">
            <Layers className="w-3.5 h-3.5" />
            <span>MÔ-ĐƯN: {moduleCode}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="text-slate-500 mt-1">{description}</p>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 shrink-0">
          <p className="text-[11px] text-slate-500">Phạm vi tác nghiệp hiện tại:</p>
          <p className="font-bold text-slate-900">{user?.unit || 'Toàn hệ thống'}</p>
        </div>
      </div>

      {/* Guest read-only banner if logged in as Guest */}
      {isGuest() && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-center space-x-3">
          <Eye className="w-5 h-5 text-amber-600 shrink-0" />
          <span>Tài khoản KHÁCH đang xem mô-đun này dưới chế độ Read-Only. Không có quyền sửa đổi dữ liệu.</span>
        </div>
      )}

      {/* Phase 2 Architecture Readiness Box */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4 max-w-2xl mx-auto my-6">
        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <Construction className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">Kiến trúc {title} đã sẵn sàng cho Giai đoạn tiếp theo</h2>
          <p className="text-slate-500">
            Nền tảng Database, Bảng dữ liệu, Phân quyền RBAC và Scope thuộc Giai đoạn 1 đã kết nối đầy đủ cho mô-đun <strong>{title}</strong>.
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl text-left border border-slate-200 space-y-2">
          <p className="font-bold text-slate-800">Kiểm tra kết nối Phân quyền Phase 1:</p>
          <ul className="space-y-1 text-slate-600">
            <li className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Người dùng: <strong>{user?.full_name}</strong> ({user?.username})</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Nhóm vai trò: <strong>{user?.roles?.join(', ')}</strong></span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Phạm vi Scope: <strong>{'Unit'} - {user?.unit}</strong></span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
