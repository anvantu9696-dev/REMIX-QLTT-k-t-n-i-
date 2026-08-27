import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Edit2,
  RefreshCw,
  X,
  ExternalLink,
  Layers,
  Building2,
  Zap,
  Info,
  Sparkles
} from 'lucide-react';
import { TopologyValidationReport } from '../../lib/topologyValidator';

interface TopologyDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: TopologyValidationReport | null;
  loopName?: string;
  loopCode?: string;
  onRecheck?: () => void;
  onEditLoop?: (loopId: string | number) => void;
  onFocusNode?: (nodeId: string) => void;
  isChecking?: boolean;
}

export const TopologyDiagnosticsModal: React.FC<TopologyDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  report,
  loopName,
  loopCode,
  onRecheck,
  onEditLoop,
  onFocusNode,
  isChecking = false
}) => {
  if (!isOpen || !report) return null;

  const displayLoopCode = loopCode || report.loopCode;
  const displayLoopName = loopName;

  const validItems = report.items.filter(i => i.status === 'VALID');
  const invalidItems = report.items.filter(i => i.status === 'INVALID');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div
        id="topology-diagnostics-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div
          className={`p-6 border-b flex items-start justify-between ${
            report.isValid
              ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50'
              : 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl flex items-center justify-center shrink-0 ${
                report.isValid
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
              }`}
            >
              {report.isValid ? (
                <ShieldCheck className="w-8 h-8" />
              ) : (
                <ShieldAlert className="w-8 h-8" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    report.isValid
                      ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {report.isValid ? '🟢 Topology hợp lệ' : '🔴 Topology có lỗi'}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Kiểm tra lúc: {report.checkedAt}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {report.isValid ? 'Sơ đồ Topology đạt chuẩn 100%' : 'Phát hiện lỗi Topology Khép vòng'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Khép vòng:{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {report.loopCode}
                </span>{' '}
                {report.isValid ? (
                  '• Cấu trúc 7 nút nguồn và liên kết đã hoàn toàn chính xác.'
                ) : (
                  `• Có ${report.errorCount} điểm không phù hợp cần xử lý.`
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Standard 7-Node Flow Indicator */}
        <div className="bg-slate-50 dark:bg-slate-950/60 px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 shadow-inner">
          <div className="text-[11px] font-black tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-2">
            Cấu trúc 7 Nút bắt buộc:
          </div>
          <div className="flex items-center flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-sky-500" /> Trạm A
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <span className="px-2.5 py-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Tuyến A
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <span className="px-2.5 py-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300">
              Thiết bị A
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-500 font-black animate-pulse" />
            {/* PROMINENT ĐIỂM DỪNG PHÁP LÝ BADGE */}
            <span className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 via-purple-600 to-amber-500 text-white rounded-xl font-black shadow-[0_0_15px_rgba(245,158,11,0.5)] border-2 border-amber-300 ring-2 ring-amber-400/50 flex items-center gap-1.5 scale-105 animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              <span>⭐ ĐIỂM DỪNG PHÁP LÝ (TRUNG TÂM) ⭐</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-500 font-black animate-pulse" />
            <span className="px-2.5 py-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300">
              Thiết bị B
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <span className="px-2.5 py-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Tuyến B
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <span className="px-2.5 py-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-sky-500" /> Trạm B
            </span>
          </div>
        </div>

        {/* Content Body / Diagnostic Checklist */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 divide-y divide-slate-100 dark:divide-slate-800">
          {/* Formatted Diagnostic Output Card (Exact layout specified in user prompt) */}
          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-sm shadow-inner space-y-2 border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <span className="font-bold flex items-center gap-1.5">
                {report.isValid ? (
                  <span className="text-emerald-400">🟢 TOPOLOGY HỢP LỆ</span>
                ) : (
                  <span className="text-rose-400">🔴 LỖI TOPOLOGY</span>
                )}
              </span>
              <span className="text-xs text-slate-400">Khép vòng: {report.loopCode}</span>
            </div>

            {/* List all items */}
            <div className="space-y-1.5 pt-1">
              {invalidItems.map((item, idx) => (
                <div key={`err-${idx}`} className="text-rose-400 flex items-start gap-2">
                  <span className="font-bold text-rose-500">✕</span>
                  <div>
                    <span>{item.message}</span>
                    {item.details && (
                      <div className="text-xs text-rose-300/80 pl-4">{item.details}</div>
                    )}
                  </div>
                </div>
              ))}

              {validItems.map((item, idx) => (
                <div key={`val-${idx}`} className="text-emerald-400 flex items-start gap-2">
                  <span className="font-bold text-emerald-500">✓</span>
                  <span>{item.message}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed breakdown list */}
          {invalidItems.length > 0 && (
            <div className="pt-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-rose-500" /> Chi tiết các mục cần điều chỉnh:
              </h3>
              <div className="space-y-2.5">
                {invalidItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                          {item.label}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          [{item.category}]
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1.5">
                        {item.message}
                      </p>
                      {item.details && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 bg-white/60 dark:bg-slate-900/60 p-2 rounded border border-slate-200 dark:border-slate-800">
                          {item.details}
                        </p>
                      )}
                    </div>

                    {item.nodeId && onFocusNode && (
                      <button
                        onClick={() => {
                          onFocusNode(item.nodeId!);
                          onClose();
                        }}
                        className="shrink-0 text-xs px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-300 dark:border-slate-700 transition"
                      >
                        Định vị nút
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EVN Operational Principle Guidance */}
          <div className="pt-4 flex items-start gap-3 text-xs text-slate-500 dark:text-slate-400">
            <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
            <p>
              Hệ thống tuyệt đối không tự ý xóa hoặc thay đổi dữ liệu sơ đồ của bạn. Để sửa các lỗi cấu trúc
              trên, hãy bấm vào nút <strong>[Chỉnh sửa Khép vòng]</strong> để cập nhật lại danh mục thiết bị, phát tuyến hoặc trạm nguồn tương ứng.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          {onRecheck && (
            <button
              onClick={onRecheck}
              disabled={isChecking}
              className="px-4 py-2 text-sm font-semibold rounded-xl text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              Kiểm tra lại
            </button>
          )}

          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Đóng
            </button>

            {onEditLoop && (
              <button
                onClick={() => {
                  onClose();
                  onEditLoop(report.loopId);
                }}
                className="px-5 py-2 text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Chỉnh sửa Khép vòng
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
