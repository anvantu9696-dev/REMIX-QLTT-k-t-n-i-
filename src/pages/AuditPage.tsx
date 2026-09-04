import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert, Search, Filter, RefreshCw,
  CheckCircle2, XCircle, User, Globe, Clock
} from 'lucide-react';
import { api } from '../lib/api';
import { AuditLog } from '../types';
import { formatDateTime, formatRelativeTime } from '../utils/dateTime';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [module, setModule] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getAuditLogs({
        limit: 20,
        search: debouncedSearch || undefined,
        module: module || undefined,
        result: result || undefined
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

  useEffect(() => {
    fetchLogs();
  }, [debouncedSearch, module, result]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.getAuditLogs({
        limit: 20,
        search: debouncedSearch || undefined,
        module: module || undefined,
        result: result || undefined,
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-sky-600 dark:text-sky-400" />
            Nhật Ký Audit System & An Ninh
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Ghi vết toàn bộ hành động người dùng, IP truy cập và lịch sử biến động hệ thống (Đang hiển thị {logs.length} bản ghi)
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm Mới
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm theo username, tên, hành động..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <select
          value={module}
          onChange={(e) => setModule(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none"
        >
          <option value="">Tất cả Phân Hệ (Module)</option>
          <option value="AUTH">AUTH (Đăng Nhập)</option>
          <option value="USERS">USERS (Người Dùng)</option>
          <option value="DEVICES">DEVICES (Thiết Bị)</option>
          <option value="LOOPS">LOOPS (Khép Vòng)</option>
          <option value="TASKS">TASKS (Giao Việc)</option>
          <option value="IMPORT">IMPORT (Nhập Excel)</option>
          <option value="HE_THONG">HE_THONG (Hệ Thống)</option>
        </select>

        <select
          value={result}
          onChange={(e) => setResult(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none"
        >
          <option value="">Tất cả Kết Quả</option>
          <option value="SUCCESS">Thành Công (SUCCESS)</option>
          <option value="FAILURE">Thất Bại (FAILURE)</option>
        </select>

        <button
          onClick={() => { setSearch(''); setModule(''); setResult(''); }}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
        >
          Xóa Bộ Lọc
        </button>
      </div>

      {/* Audit Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Đang tải nhật ký...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">Không tìm thấy nhật ký audit phù hợp</div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold sticky top-0 z-10">
                  <th className="p-3.5">Thời Gian</th>
                  <th className="p-3.5">Người Thực Hiện</th>
                  <th className="p-3.5">Hành Động</th>
                  <th className="p-3.5">Phân Hệ</th>
                  <th className="p-3.5">Mục Tiêu (Target)</th>
                  <th className="p-3.5">Địa Chỉ IP</th>
                  <th className="p-3.5">Chi Tiết</th>
                  <th className="p-3.5 text-right">Kết Quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {formatDateTime(log.created_at)}
                      </div>
                      <div className="text-[10px] text-sky-600 dark:text-sky-400 font-medium flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{formatRelativeTime(log.created_at)}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{log.user_fullname}</p>
                          <p className="text-[10px] text-slate-400">@{log.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-bold font-mono text-sky-700 dark:text-sky-300">
                      {log.action}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-bold rounded">
                        {log.module}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">
                      {log.target_id || '-'}
                    </td>
                    <td className="p-3.5 font-mono text-slate-500 flex items-center gap-1">
                      <Globe className="w-3 h-3 text-slate-400" />
                      {log.ip_address}
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={log.details}>
                      {log.details || '-'}
                    </td>
                    <td className="p-3.5 text-right">
                      {log.result === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> SUCCESS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 font-bold text-[10px] rounded-full">
                          <XCircle className="w-3 h-3" /> FAILURE
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Load More Button */}
      {nextCursor && (
        <div className="flex justify-center pt-2 pb-6">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-sky-600 dark:text-sky-400 font-bold text-xs rounded-xl border border-sky-200 dark:border-sky-800 shadow-sm flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Đang tải thêm...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tải thêm nhật ký (Xem thêm 20 bản ghi)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
