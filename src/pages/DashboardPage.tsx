import React, { useState, useEffect } from 'react';
import {
  Zap,
  Building2,
  GitCommitHorizontal,
  CircleDot,
  Briefcase,
  CheckSquare,
  AlertTriangle,
  ArrowRight,
  Plus,
  FileBarChart,
  Upload,
  MapPin,
  Clock,
  ChevronRight,
  Activity,
  Layers,
  Sparkles,
  ShieldCheck,
  Eye,
  FileText,
  CheckCircle2,
  FileCheck,
  UserCheck,
  ShieldAlert,
  Inbox,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { DashboardStats, AuditLog, Task } from '../types';
import { formatDateTime, formatRelativeTime } from '../utils/dateTime';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

interface CriticalDeviceItem {
  id: number;
  name: string;
  device_id: string;
  device_type: string;
  pole_number?: string;
  feeder_name?: string;
  substation_name?: string;
  status: string;
  issue_description?: string;
  severity?: 'CRITICAL' | 'WARNING' | 'MAINTENANCE' | 'NORMAL';
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user, isGuest, hasPermission } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentAudits, setRecentAudits] = useState<AuditLog[]>([]);
  const [pendingApprovalTasks, setPendingApprovalTasks] = useState<Task[]>([]);
  const [activityTab, setActivityTab] = useState<'pending' | 'audit'>('pending');
  const [criticalDevices, setCriticalDevices] = useState<CriticalDeviceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsRes, tasksRes] = await Promise.all([
        api.getDashboardStats(),
        api.getTasks({ status: 'PENDING_APPROVAL' })
      ]);

      if (statsRes.success) {
        setStats(statsRes.data);
      }

      if (tasksRes.success && Array.isArray(tasksRes.data)) {
        setPendingApprovalTasks(tasksRes.data);
        if (tasksRes.data.length > 0) {
          setActivityTab('pending');
        } else {
          setActivityTab('audit');
        }
      }

      if (hasPermission('audit:read')) {
        const auditRes = await api.getAuditLogs({ limit: 6 });
        if (auditRes.success) {
          setRecentAudits(auditRes.data);
        }
      }

      // Load devices to populate the "Thiết bị cần xử lý ngay" table
      try {
        const devRes = await api.getDevices();
        if (devRes.success && Array.isArray(devRes.data)) {
          // Filter or pick devices with issues, maintenance, or high priority
          const allDevs = devRes.data;
          const abnormalDevs = allDevs.filter((d: any) => 
            d.status === 'INACTIVE' || 
            d.status === 'MAINTENANCE' || 
            d.scada_status === 'NO_SIGNAL' ||
            d.battery_status === 'WEAK' || 
            d.battery_status === 'BROKEN'
          );

          const displayList: CriticalDeviceItem[] = abnormalDevs.map((d: any) => ({
            id: d.id,
            name: d.name || `Thiết bị ${d.device_id}`,
            device_id: d.device_id || `DEV-${d.id}`,
            device_type: d.device_type || 'RECLOSER',
            pole_number: d.pole_number || `Trụ ${d.id}/ĐZ`,
            feeder_name: d.feeder_name || '471 E1.1',
            substation_name: d.substation_name || '110kV Đông Hà',
            status: d.status === 'MAINTENANCE' 
              ? 'BẢO TRÌ' 
              : d.scada_status === 'NO_SIGNAL' 
                ? 'MẤT SCADA' 
                : d.battery_status === 'WEAK' 
                  ? 'PIN YẾU' 
                  : 'BẤT THƯỜNG',
            severity: d.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'CRITICAL'
          }));

          setCriticalDevices(displayList.slice(0, 5));
        }
      } catch (err) {
        console.warn('Failed to load critical devices list:', err);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, severity?: string) => {
    switch (status) {
      case 'BẤT THƯỜNG':
      case 'MẤT SCADA':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            {status}
          </span>
        );
      case 'CẦN KIỂM TRA':
      case 'PIN YẾU':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            {status}
          </span>
        );
      case 'BẢO TRÌ':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {status}
          </span>
        );
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'URGENT':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 border border-red-200">Khẩn cấp</span>;
      case 'HIGH':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-200">Cao</span>;
      case 'LOW':
        return <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-600 border border-slate-200">Thấp</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200">Trung bình</span>;
    }
  };

  const pendingCount = pendingApprovalTasks.length;

  return (
    <div className="space-y-6">
      {/* Operational Snapshot KPI Banner: Active Tasks, Pending Approvals, Upcoming Maintenance Deadlines */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 font-bold text-[11px] mb-2 uppercase tracking-wider border border-blue-400/30">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              <span>Snapshot Vận Hành Thời Gian Thực</span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">Tổng Quan Trạng Thái Lưới Điện & Tác Nghiệp</h2>
            <p className="text-xs text-slate-300">Cập nhật liên tục các công việc đang thực hiện, phê duyệt chờ xử lý và hạn định bảo trì.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('/tasks')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow flex items-center gap-1.5 cursor-pointer"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Quản Lý Công Việc</span>
            </button>
            <button
              onClick={() => onNavigate('/inspections')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition border border-white/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Lịch Kiểm Tra</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
          {/* KPI 1: Active Tasks */}
          <div 
            onClick={() => onNavigate('/tasks')}
            className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-xl p-4 border border-white/10 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Công việc đang thực hiện</span>
              <div className="p-2 rounded-lg bg-blue-500/30 text-blue-300 group-hover:bg-blue-500/50 transition">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-3xl font-black font-mono text-white">{stats?.active_tasks ?? 0}</div>
              <span className="text-[11px] text-blue-300 font-bold group-hover:underline flex items-center gap-1">
                Chi tiết <ChevronRight className="w-3 h-3" />
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Đang triển khai xử lý trên các tuyến dây & trạm
            </div>
          </div>

          {/* KPI 2: Pending Approvals */}
          <div 
            onClick={() => onNavigate('/tasks?status=PENDING_APPROVAL')}
            className={`bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-xl p-4 border ${pendingCount > 0 ? 'border-amber-400/50 bg-amber-500/10' : 'border-white/10'} transition cursor-pointer group`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Phê duyệt chờ xác nhận</span>
              <div className={`p-2 rounded-lg ${pendingCount > 0 ? 'bg-amber-500/30 text-amber-300 animate-pulse' : 'bg-white/10 text-slate-300'}`}>
                <FileCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className={`text-3xl font-black font-mono ${pendingCount > 0 ? 'text-amber-400' : 'text-white'}`}>{pendingCount}</div>
              <span className="text-[11px] text-amber-300 font-bold group-hover:underline flex items-center gap-1">
                Xử lý ngay <ChevronRight className="w-3 h-3" />
              </span>
            </div>
            <div className="mt-2 text-[11px] text-amber-300/80">
              {pendingCount > 0 ? 'Yêu cầu nghiệm thu cần duyệt' : 'Không có yêu cầu tồn đọng'}
            </div>
          </div>

          {/* KPI 3: Upcoming Maintenance Deadlines */}
          <div 
            onClick={() => onNavigate('/inspections')}
            className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-xl p-4 border border-white/10 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Hạn bảo trì & Kiểm tra</span>
              <div className="p-2 rounded-lg bg-purple-500/30 text-purple-300 group-hover:bg-purple-500/50 transition">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-3xl font-black font-mono text-purple-300">{stats?.upcoming_inspections ?? 0}</div>
              <span className="text-[11px] text-purple-300 font-bold group-hover:underline flex items-center gap-1">
                Xem lịch <ChevronRight className="w-3 h-3" />
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Lịch định kỳ sắp đến hạn trong vòng 7 ngày tới
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Stat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng thiết bị */}
        <div
          onClick={() => onNavigate('/equipment')}
          className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tổng thiết bị
            </span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 transition-colors">
              <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
              {stats?.total_equipment ?? 0}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
              <span>Đang quản lý trên lưới</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold group-hover:underline flex items-center gap-0.5">
                Xem <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Trạm 110kV */}
        <div
          onClick={() => onNavigate('/stations')}
          className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Trạm 110kV
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 transition-colors">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
              {stats?.total_stations_110kv ?? 0}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">100% vận hành</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold group-hover:underline flex items-center gap-0.5">
                Xem <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Phát tuyến */}
        <div
          onClick={() => onNavigate('/feeders')}
          className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Phát tuyến
            </span>
            <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900 transition-colors">
              <GitCommitHorizontal className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
              {stats?.total_feeders ?? 0}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
              <span>Trung áp 22/35kV</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold group-hover:underline flex items-center gap-0.5">
                Xem <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Khép vòng */}
        <div
          onClick={() => onNavigate('/loops')}
          className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Khép vòng
            </span>
            <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/60 group-hover:bg-teal-100 dark:group-hover:bg-teal-900 transition-colors">
              <CircleDot className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
              {stats?.total_ring_loops ?? 0}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
              <span>Mạch vòng liên lạc</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold group-hover:underline flex items-center gap-0.5">
                Xem <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle 4 Status Operational Cards (With Colored Left Borders) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status 1: Bất thường (Danger Rose border) */}
        <div
          onClick={() => onNavigate('/anomalies')}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-rose-500 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Bất thường</span>
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
              {stats?.active_issues ?? 0}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-rose-600 dark:text-rose-400 font-medium">
            <span>Cần xử lý ngay</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Status 2: Cần kiểm tra (Warning Amber border) */}
        <div
          onClick={() => onNavigate('/inspections')}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-amber-500 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Cần kiểm tra</span>
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
              {stats?.upcoming_inspections ?? 0}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            <span>Trong 7 ngày</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Status 3: Đang thực hiện (Accent Blue border) */}
        <div
          onClick={() => onNavigate('/tasks')}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-blue-500 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Đang thực hiện</span>
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
              {stats?.active_tasks ?? 0}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400 font-medium">
            <span>Công việc giao</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Status 4: Chờ xác nhận (Amber / Orange border) */}
        <div
          onClick={() => onNavigate('/tasks?status=PENDING_APPROVAL')}
          className={`bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 border-l-4 ${
            pendingCount > 0 ? 'border-l-amber-500 ring-1 ring-amber-400/30' : 'border-l-slate-400'
          } shadow-xs hover:shadow-md transition-all cursor-pointer group`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className={`w-4 h-4 ${pendingCount > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Chờ xác nhận</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-2xl font-bold font-mono ${pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
                {pendingCount}
              </span>
              {pendingCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-medium">
            <span className={pendingCount > 0 ? 'text-amber-700 dark:text-amber-400 font-bold' : 'text-slate-400'}>
              {pendingCount > 0 ? 'Cần duyệt nghiệm thu' : 'Không có việc tồn'}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Main Dashboard Section: Left Panel (Thiết bị cần xử lý ngay) + Right Panel (Thao tác nhanh & Hoạt động / Cần duyệt) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel (7 Cols on large screen): "Thiết bị cần xử lý ngay" */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col overflow-hidden">
          {/* Panel Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Thiết bị cần xử lý ngay
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                Cập nhật vừa xong
              </span>
              <button
                onClick={() => onNavigate('/anomalies')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Xem tất cả
              </button>
            </div>
          </div>

          {/* Device Table */}
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-6">Thiết bị</th>
                  <th className="py-3 px-6">Vị trí / Trụ</th>
                  <th className="py-3 px-6">Phát tuyến</th>
                  <th className="py-3 px-6">Trạng thái</th>
                  <th className="py-3 px-6 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {criticalDevices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Không có thiết bị nào trong trạng thái cảnh báo nguy hiểm.
                    </td>
                  </tr>
                ) : (
                  criticalDevices.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => onNavigate('/equipment')}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <span>{item.name}</span>
                          <span className="text-[10px] font-mono text-slate-400 font-normal">
                            ({item.device_id})
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-300 font-mono">
                        {item.pole_number}
                      </td>
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-300">
                        {item.feeder_name}
                      </td>
                      <td className="py-3.5 px-6">
                        {getStatusBadge(item.status, item.severity)}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('/equipment');
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel (5 Cols): "Thao tác nhanh" + "Recent Activity & Pending Approval Widget" */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Actions Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Thao tác nhanh
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                onClick={() => onNavigate('/equipment')}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 transition-all flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer"
              >
                <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  + THIẾT BỊ
                </span>
              </button>

              <button
                onClick={() => onNavigate('/tasks')}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-950/40 transition-all flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer"
              >
                <Briefcase className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  GIAO VIỆC
                </span>
              </button>

              <button
                onClick={() => onNavigate('/reports')}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 transition-all flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer"
              >
                <FileBarChart className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  BÁO CÁO
                </span>
              </button>

              <button
                onClick={() => onNavigate('/gis-map')}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-rose-500 dark:hover:border-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-950/40 transition-all flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  BẢN ĐỒ GIS
                </span>
              </button>
            </div>
          </div>

          {/* RECENT ACTIVITY & PENDING APPROVAL WIDGET */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            {/* Widget Header with Interactive Tabs */}
            <div className="p-4 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 bg-slate-200/80 dark:bg-slate-700/80 p-1 rounded-lg">
                <button
                  onClick={() => setActivityTab('pending')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activityTab === 'pending'
                      ? 'bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <FileCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Chờ xác nhận</span>
                  {pendingCount > 0 ? (
                    <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-black animate-pulse">
                      {pendingCount}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-full text-[10px]">
                      0
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActivityTab('audit')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activityTab === 'audit'
                      ? 'bg-white dark:bg-slate-900 text-blue-900 dark:text-blue-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Nhật ký gần đây</span>
                </button>
              </div>

              {activityTab === 'pending' ? (
                <button
                  onClick={() => onNavigate('/tasks?status=PENDING_APPROVAL')}
                  className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>Tất cả</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              ) : (
                hasPermission('audit:read') && (
                  <button
                    onClick={() => onNavigate('/audit-logs')}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span>Tất cả</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )
              )}
            </div>

            {/* Widget Body */}
            <div className="p-4">
              {activityTab === 'pending' ? (
                <div className="space-y-3">
                  {/* Manager Callout Alert */}
                  {pendingCount > 0 ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-950 dark:text-amber-200">
                      <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-bold">
                          {pendingCount} công việc đã hoàn thành đang chờ quản lý nghiệm thu
                        </p>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300/90 mt-0.5">
                          Kiểm tra ảnh hiện trường, biên bản kiểm tra và xác nhận đóng phiếu công tác.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* List of Tasks Pending Approval */}
                  {pendingApprovalTasks.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Không có công việc nào đang chờ xác nhận
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                        Tất cả các phiếu công việc hoàn thành đều đã được nghiệm thu và phê duyệt đầy đủ.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {pendingApprovalTasks.slice(0, 4).map((task) => (
                        <div
                          key={task.id}
                          onClick={() => onNavigate(`/tasks?taskId=${task.id}`)}
                          className="p-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] font-black text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                {task.task_code}
                              </span>
                              {getPriorityBadge(task.priority)}
                            </div>
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Chờ nghiệm thu
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors line-clamp-1">
                            {task.title}
                          </h4>

                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-3">
                              {task.assigned_to_fullname ? (
                                <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                                  <UserCheck className="w-3 h-3 text-blue-500" />
                                  <span>{task.assigned_to_fullname}</span>
                                </span>
                              ) : null}

                              {(task.device_name || task.pole_number) ? (
                                <span className="flex items-center gap-1 text-slate-500">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  <span>{task.device_name || task.pole_number}</span>
                                </span>
                              ) : null}
                            </div>

                            <span className="text-amber-600 dark:text-amber-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 text-[10px]">
                              Nghiệm thu <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      ))}

                      {pendingApprovalTasks.length > 4 && (
                        <button
                          onClick={() => onNavigate('/tasks?status=PENDING_APPROVAL')}
                          className="w-full py-2 text-center text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg border border-dashed border-amber-300 dark:border-amber-800 transition cursor-pointer"
                        >
                          Xem thêm {pendingApprovalTasks.length - 4} công việc chờ xác nhận khác →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* AUDIT TIMELINE VIEW */
                <div className="space-y-3.5">
                  {recentAudits.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">Chưa có nhật ký hoạt động gần đây.</p>
                  ) : (
                    recentAudits.slice(0, 5).map((audit, idx) => (
                      <div key={audit.id} className="relative pl-5 pb-1 border-l-2 border-slate-200 dark:border-slate-800 last:border-l-0">
                        <span className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ${
                          idx === 0 
                            ? 'bg-blue-500 ring-4 ring-blue-50 dark:ring-blue-950' 
                            : idx === 1 
                              ? 'bg-amber-500' 
                              : idx === 2 
                                ? 'bg-emerald-500' 
                                : 'bg-slate-400'
                        }`}></span>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                          {audit.details || audit.action}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center justify-between">
                          <span className="font-sans font-medium text-slate-600 dark:text-slate-400">{audit.user_fullname || audit.username}</span>
                          <span className="text-blue-600 dark:text-blue-400 font-sans font-semibold flex items-center gap-1" title={formatDateTime(audit.created_at)}>
                            <Clock className="w-2.5 h-2.5" />
                            {formatRelativeTime(audit.created_at)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

