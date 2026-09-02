import React, { useState, useEffect } from 'react';
import { Activity, Search, ShieldAlert, CheckCircle2, XCircle, Filter, RefreshCw, FileText, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { AuditLog } from '../types';
import { formatDateTime, formatRelativeTime } from '../utils/dateTime';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const [moduleFilter, setModuleFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');

  useEffect(() => {
    fetchAuditLogs();
  }, [debouncedSearch, moduleFilter, resultFilter]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs({
        search: debouncedSearch || undefined,
        module: moduleFilter || undefined,
        result: resultFilter || undefined,
        limit: 20
      });
      if (res.success) {
        setLogs(res.data);
        setNextCursor(res.nextCursor || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await api.getAuditLogs({
        search: search || undefined,
        module: moduleFilter || undefined,
        result: resultFilter || undefined,
        limit: 20,
        lastDocId: nextCursor
      });
      if (res.success) {
        setLogs(prev => {
          const existing = new Set(prev.map(l => l.id));
          const newItems = res.data.filter((l: any) => !existing.has(l.id));
          return [...prev, ...newItems];
        });
        setNextCursor(res.nextCursor || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Nhật ký Hệ thống & An toàn Tác nghiệp (Audit Logs)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Ghi nhận toàn bộ thao tác người dùng, thời gian, IP, hành động và kết quả nhằm phục vụ công tác giám sát an toàn thông tin.
          </p>
        </div>

        <button
          onClick={fetchAuditLogs}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 flex items-center space-x-2 shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Immutable Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Quy định Bảo lưu Nhật ký (Compliance Notice):</p>
          <p className="mt-0.5 opacity-90">
            Dữ liệu nhật ký tác nghiệp được lưu trữ bất biến (Immutable Audit Logs). Người dùng thường và cán bộ quản lý KHÔNG CÓ QUYỀN sửa đổi hoặc xóa các bản ghi này dưới mọi hình thức.
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo Username, Tên, Chi tiết hành động..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="bg-transparent text-slate-700 font-semibold focus:outline-none"
            >
              <option value="">Tất cả Module</option>
              <option value="XAC_THUC">Xác thực Đăng nhập</option>
              <option value="QUAN_LY_NGUOI_DUNG">Quản lý Người dùng</option>
              <option value="PHAN_QUYEN">Phân quyền RBAC</option>
              <option value="QUAN_LY_THIET_BI">Quản lý Thiết bị</option>
              <option value="CONG_VIEC">Công việc Vận hành</option>
              <option value="TAI_LIEU">Tài liệu Kỹ thuật</option>
              <option value="HE_THONG">Khởi tạo Hệ thống</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="bg-transparent text-slate-700 font-semibold focus:outline-none"
            >
              <option value="">Tất cả Kết quả</option>
              <option value="SUCCESS">Thành công (SUCCESS)</option>
              <option value="FAILURE">Thất bại (FAILURE)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="text-xs font-semibold text-slate-600">
        Đang hiển thị {logs.length} nhật ký
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-4">Thời gian</th>
                <th className="p-4">Người thực hiện</th>
                <th className="p-4">Module</th>
                <th className="p-4">Hành động & Chi tiết</th>
                <th className="p-4">Địa chỉ IP</th>
                <th className="p-4 text-right">Kết quả</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Đang tải danh sách nhật ký từ database...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Không có nhật ký nào phù hợp
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 whitespace-nowrap">
                      <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {formatDateTime(log.created_at)}
                      </div>
                      <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{formatRelativeTime(log.created_at)}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      <p className="font-bold text-slate-900">{log.user_fullname}</p>
                      <p className="text-[11px] text-slate-400 font-mono">@{log.username}</p>
                    </td>

                    <td className="p-4 font-bold text-slate-700">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {log.module}
                      </span>
                    </td>

                    <td className="p-4">
                      <p className="font-semibold text-slate-900">{log.action}</p>
                      {log.details && <p className="text-slate-500 text-[11px] mt-0.5">{log.details}</p>}
                    </td>

                    <td className="p-4 font-mono text-slate-500">
                      {log.ip_address || '127.0.0.1'}
                    </td>

                    <td className="p-4 text-right whitespace-nowrap">
                      {log.result === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          SUCCESS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                          <XCircle className="w-3 h-3 text-red-600" />
                          FAILURE
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {nextCursor && (
        <div className="mt-6 flex justify-center pb-6">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center transition-colors shadow-sm font-medium"
          >
            {loadingMore ? 'Đang tải...' : 'Tải thêm nhật ký'}
          </button>
        </div>
      )}
    </div>
  );
};
