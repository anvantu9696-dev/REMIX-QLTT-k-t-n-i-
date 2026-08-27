import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  RefreshCw,
  Download,
  X,
  Zap,
  Radio,
  SlidersHorizontal,
  ChevronDown,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { Device } from '../../types';

interface BulkActionsBarProps {
  selectedCount: number;
  totalFilteredCount: number;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onOpenBulkStatusModal: () => void;
  onOpenBulkExportModal: () => void;
  onQuickUpdateStatus?: (updates: any, reason: string) => Promise<void>;
  canUpdate: boolean;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  totalFilteredCount,
  onSelectAllFiltered,
  onClearSelection,
  onOpenBulkStatusModal,
  onOpenBulkExportModal,
  onQuickUpdateStatus,
  canUpdate
}) => {
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);

  if (selectedCount === 0) return null;

  const handleQuickAction = async (updates: any, reason: string) => {
    if (!onQuickUpdateStatus) return;
    if (!window.confirm(`Xác nhận áp dụng nhanh "${reason}" cho ${selectedCount} thiết bị đã chọn?`)) {
      return;
    }
    setQuickLoading(true);
    try {
      await onQuickUpdateStatus(updates, reason);
    } finally {
      setQuickLoading(false);
      setQuickMenuOpen(false);
    }
  };

  return (
    <div className="bg-slate-900 text-white rounded-xl p-3 sm:p-3.5 shadow-xl border border-slate-700 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Left: Selection Counter & Select/Deselect all */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-blue-950/80 px-3 py-1.5 rounded-lg border border-blue-800">
          <CheckSquare className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-blue-200">
            Đã chọn: <span className="text-white font-mono text-sm">{selectedCount}</span> / {totalFilteredCount} thiết bị
          </span>
        </div>

        {selectedCount < totalFilteredCount && (
          <button
            onClick={onSelectAllFiltered}
            className="text-xs text-blue-300 hover:text-white underline underline-offset-2 font-semibold transition-colors"
          >
            Chọn tất cả {totalFilteredCount} TB
          </button>
        )}

        <button
          onClick={onClearSelection}
          className="text-xs text-slate-400 hover:text-slate-200 font-medium flex items-center gap-1 transition-colors"
          title="Bỏ chọn tất cả"
        >
          <X className="w-3.5 h-3.5" />
          Hủy chọn
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center flex-wrap gap-2">
        {/* Quick Actions Dropdown (If user has update permission) */}
        {canUpdate && onQuickUpdateStatus && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setQuickMenuOpen(!quickMenuOpen)}
              disabled={quickLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Thao tác nhanh</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {quickMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setQuickMenuOpen(false)}
                />
                <div className="absolute right-0 bottom-full mb-2 w-56 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 py-1.5 z-30 text-xs font-medium divide-y divide-slate-100">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Thao tác nhanh hàng loạt
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => handleQuickAction({ switch_status: 'CLOSED' }, 'Chuyển nhanh trạng thái Đóng dao')}
                      className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-emerald-800 flex items-center gap-2 font-semibold"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      Đóng dao tất cả (CLOSED)
                    </button>
                    <button
                      onClick={() => handleQuickAction({ switch_status: 'OPEN' }, 'Chuyển nhanh trạng thái Mở dao')}
                      className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-800 flex items-center gap-2 font-semibold"
                    >
                      <span className="w-2 h-2 rounded-full bg-red-600" />
                      Mở dao tất cả (OPEN)
                    </button>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => handleQuickAction({ scada_status: 'SIGNAL' }, 'Cập nhật SCADA Có tín hiệu')}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 text-blue-800 flex items-center gap-2 font-semibold"
                    >
                      <Radio className="w-3.5 h-3.5 text-blue-600" />
                      Đặt SCADA: Có tín hiệu
                    </button>
                    <button
                      onClick={() => handleQuickAction({ scada_status: 'NO_SIGNAL' }, 'Cập nhật SCADA Mất tín hiệu')}
                      className="w-full text-left px-3 py-2 hover:bg-amber-50 text-amber-800 flex items-center gap-2 font-semibold"
                    >
                      <Radio className="w-3.5 h-3.5 text-amber-600" />
                      Đặt SCADA: Mất tín hiệu
                    </button>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => handleQuickAction({ status: 'MAINTENANCE' }, 'Chuyển trạng thái Bảo dưỡng/Sửa chữa')}
                      className="w-full text-left px-3 py-2 hover:bg-amber-50 text-amber-800 flex items-center gap-2 font-semibold"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-600" />
                      Chuyển sang BẢO DƯỠNG
                    </button>
                    <button
                      onClick={() => handleQuickAction({ status: 'ACTIVE' }, 'Khôi phục trạng thái Đang vận hành')}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 text-blue-800 flex items-center gap-2 font-semibold"
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                      Đặt lại ĐANG VẬN HÀNH
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Bulk Status Update Button */}
        {canUpdate && (
          <button
            onClick={onOpenBulkStatusModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
            title="Mở biểu mẫu cập nhật trạng thái chi tiết"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Cập nhật Trạng thái</span>
          </button>
        )}

        {/* Bulk Export Reports Button */}
        <button
          onClick={onOpenBulkExportModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
          title="Xuất các biểu mẫu báo cáo cho các thiết bị đã chọn"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Xuất Báo cáo ({selectedCount})</span>
        </button>
      </div>
    </div>
  );
};
