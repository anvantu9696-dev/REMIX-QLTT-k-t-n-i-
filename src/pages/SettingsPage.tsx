import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Lock,
  X,
  Database,
  Check,
  Sun,
  Moon,
  Monitor,
  Palette,
  Eye,
  Sliders,
  User,
  Shield,
  Layers,
  Sparkles,
  Zap,
  Activity,
  CheckCheck,
  LogOut
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme, Theme } from '../context/ThemeContext';
import { LogoutModal } from '../components/common/LogoutModal';
import { ChangePasswordModal } from '../components/common/ChangePasswordModal';
import { SystemBackup } from '../types';
import { formatDateTime, formatRelativeTime } from '../utils/dateTime';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ADMIN');
  const {
    theme,
    resolvedTheme,
    setTheme,
    compactDensity,
    setCompactDensity,
    highContrast,
    setHighContrast
  } = useTheme();

  const [activeTab, setActiveTab] = useState<'THEME' | 'PROFILE' | 'ADMIN'>('THEME');
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  // Backup & Restore states
  const [backups, setBackups] = useState<SystemBackup[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupActionLoading, setBackupActionLoading] = useState(false);
  const [latestBackupModalOpen, setLatestBackupModalOpen] = useState(false);
  const [latestBackupData, setLatestBackupData] = useState<{ backup: any; current_counts: any } | null>(null);
  const [createBackupModalOpen, setCreateBackupModalOpen] = useState(false);
  const [manualBackupName, setManualBackupName] = useState('');
  const [manualBackupNotes, setManualBackupNotes] = useState('');
  const [restoreResultModal, setRestoreResultModal] = useState<any | null>(null);

  const loadBackups = async () => {
    if (!isAdmin) return;
    setBackupsLoading(true);
    try {
      const res = await api.getSystemBackups();
      if (res.success) {
        setBackups(res.backups);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBackupsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ADMIN' && isAdmin) {
      loadBackups();
    }
  }, [activeTab, isAdmin]);

  const handleOpenLatestBackupModal = async () => {
    setBackupActionLoading(true);
    try {
      const res = await api.getLatestBackup();
      if (res.success) {
        setLatestBackupData(res);
        setLatestBackupModalOpen(true);
      }
    } catch (err: any) {
      alert(`Không thể tải thông tin bản sao lưu gần nhất: ${err.message}`);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleRestoreLatestBackup = async () => {
    setBackupActionLoading(true);
    try {
      const res = await api.restoreLatestBackup();
      if (res.success) {
        setLatestBackupModalOpen(false);
        setRestoreResultModal(res);
        loadBackups();
      }
    } catch (err: any) {
      alert(`Lỗi khôi phục: ${err.message}`);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleRestoreSpecificBackup = async (id: number | string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn khôi phục dữ liệu từ bản sao lưu #${id}? Hệ thống sẽ tự động tạo bản lưu an toàn trước khi khôi phục.`)) {
      return;
    }
    setBackupActionLoading(true);
    try {
      const res = await api.restoreBackup(id);
      if (res.success) {
        setRestoreResultModal(res);
        loadBackups();
      }
    } catch (err: any) {
      alert(`Lỗi khôi phục: ${err.message}`);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleCreateManualBackupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBackupActionLoading(true);
    try {
      const res = await api.createBackup({
        name: manualBackupName.trim() || undefined,
        notes: manualBackupNotes.trim() || undefined
      });
      if (res.success) {
        setCreateBackupModalOpen(false);
        setManualBackupName('');
        setManualBackupNotes('');
        loadBackups();
        alert(res.message);
      }
    } catch (err: any) {
      alert(`Lỗi tạo sao lưu: ${err.message}`);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleDeleteBackupItem = async (id: number | string) => {
    if (!window.confirm('Bạn có chắc muốn xóa bản sao lưu này?')) return;
    try {
      const res = await api.deleteBackup(id);
      if (res.success) {
        loadBackups();
      }
    } catch (err: any) {
      alert(`Lỗi xóa: ${err.message}`);
    }
  };

  // Reset Modal state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState<'STATS' | 'WARNING' | 'VERIFY' | 'SUCCESS'>('STATS');
  const [stats, setStats] = useState<{ devices: number; work: number; feeders: number; stations: number; topology: number; loops: number; links: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successReport, setSuccessReport] = useState<any | null>(null);

  // Loop-only Reset state
  const [loopResetModalOpen, setLoopResetModalOpen] = useState(false);
  const [loopResetStep, setLoopResetStep] = useState<'STATS' | 'CONFIRM' | 'SUCCESS'>('STATS');
  const [loopStats, setLoopStats] = useState<{ loops: number; versions: number; nodes: number; edges: number; change_requests: number } | null>(null);
  const [loopStatsLoading, setLoopStatsLoading] = useState(false);
  const [loopVerificationText, setLoopVerificationText] = useState('');
  const [loopLoading, setLoopLoading] = useState(false);
  const [loopErrorMsg, setLoopErrorMsg] = useState<string | null>(null);
  const [loopSuccessReport, setLoopSuccessReport] = useState<any | null>(null);

  const handleOpenResetModal = async () => {
    setResetModalOpen(true);
    setResetStep('STATS');
    setVerificationCode('');
    setErrorMsg(null);
    setSuccessReport(null);
    setStatsLoading(true);

    try {
      const res = await api.getResetStats();
      if (res.success) {
        setStats(res.counts);
      }
    } catch (e) {
      setStats({ devices: 0, work: 0, feeders: 0, stations: 0, topology: 0, loops: 0, links: 0 });
    } finally {
      setStatsLoading(false);
    }
  };

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      setErrorMsg('Vui lòng nhập mã xác thực.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.resetAll(verificationCode.trim());

      if (res.success) {
        setSuccessReport(res.report || {
          devices_before: stats?.devices || 0,
          devices_after: 0,
          work_before: stats?.work || 0,
          work_after: 0,
          feeders_before: stats?.feeders || 0,
          feeders_after: 0,
          substations_before: stats?.stations || 0,
          substations_after: 0,
          topology_after: 0,
          loops_after: 0,
          links_remaining: 0,
          orphans_remaining: 0
        });
        setResetStep('SUCCESS');
      } else {
        setErrorMsg(res.message || 'Mã xác thực không chính xác.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Mã xác thực không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAndReload = () => {
    setResetModalOpen(false);
    window.location.reload();
  };

  // LOOP RESET HANDLERS
  const handleOpenLoopResetModal = async () => {
    setLoopResetModalOpen(true);
    setLoopResetStep('STATS');
    setLoopVerificationText('');
    setLoopErrorMsg(null);
    setLoopSuccessReport(null);
    setLoopStatsLoading(true);

    try {
      const res = await api.getLoopResetStats();
      if (res.success) {
        setLoopStats(res.counts);
      }
    } catch (e) {
      setLoopStats({ loops: 0, versions: 0, nodes: 0, edges: 0, change_requests: 0 });
    } finally {
      setLoopStatsLoading(false);
    }
  };

  const handleExecuteLoopReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = loopVerificationText.trim().toUpperCase();
    if (clean !== 'XÓA KHÉP VÒNG' && clean !== 'XOA KHEP VONG' && clean !== 'XÓA TOÀN BỘ KHÉP VÒNG') {
      setLoopErrorMsg('Vui lòng nhập đúng cụm từ: "XÓA KHÉP VÒNG".');
      return;
    }

    setLoopLoading(true);
    setLoopErrorMsg(null);

    try {
      const res = await api.resetAllLoops(loopVerificationText.trim());
      if (res.success) {
        setLoopSuccessReport(res.deleted_count);
        setLoopResetStep('SUCCESS');
      } else {
        setLoopErrorMsg(res.message || 'Lỗi khi xóa dữ liệu Khép vòng.');
      }
    } catch (err: any) {
      setLoopErrorMsg(err.message || 'Lỗi khi xóa dữ liệu Khép vòng.');
    } finally {
      setLoopLoading(false);
    }
  };

  const themeOptions: { id: Theme; title: string; desc: string; icon: React.ReactNode; previewBg: string }[] = [
    {
      id: 'light',
      title: 'Chế độ Sáng (Light)',
      desc: 'Nền sáng tiêu chuẩn, độ tương phản cao, tối ưu cho môi trường làm việc ban ngày hoặc văn phòng.',
      icon: <Sun className="w-5 h-5 text-amber-500" />,
      previewBg: 'bg-white border-slate-200'
    },
    {
      id: 'dark',
      title: 'Chế độ Tối (Dark)',
      desc: 'Nền Deep Slate chống mỏi mắt, chuyên dụng cho ca trực đêm, phòng điều hành OCC và màn hình SCADA.',
      icon: <Moon className="w-5 h-5 text-blue-400" />,
      previewBg: 'bg-slate-900 border-slate-700'
    },
    {
      id: 'system',
      title: 'Tự động (System)',
      desc: 'Đồng bộ tự động theo cài đặt giao diện Sáng/Tối của hệ điều hành trên máy tính hoặc điện thoại.',
      icon: <Monitor className="w-5 h-5 text-indigo-400" />,
      previewBg: 'bg-gradient-to-r from-slate-100 to-slate-900 border-slate-400'
    }
  ];

  return (
    <div className="space-y-6 text-xs max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="inline-flex items-center space-x-2 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full font-bold mb-2">
            <Settings className="w-3.5 h-3.5" />
            <span>CÀI ĐẶT HỆ THỐNG & TÙY CHỌN</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Cấu Hình & Tùy Biến Giao Diện</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Điều chỉnh chế độ sáng/tối, hiển thị SCADA, quản lý thông tin người dùng và công cụ bảo trì hệ thống.
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Tài khoản hiện tại:</p>
          <p className="font-bold text-slate-900 dark:text-slate-100">{user?.full_name || 'Người dùng'} ({user?.username})</p>
          <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
            {user?.roles?.[0] || 'USER'} • {user?.unit || 'EVN - NPC'}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('THEME')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'THEME'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Giao Diện & Chế Độ Sáng / Tối</span>
        </button>

        <button
          onClick={() => setActiveTab('PROFILE')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'PROFILE'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Hồ Sơ & Phân Quyền</span>
        </button>

        <button
          onClick={() => setActiveTab('ADMIN')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'ADMIN'
              ? 'bg-red-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Bảo Trì & Reset Dữ Liệu {isAdmin && '(Admin)'}</span>
        </button>
      </div>

      {/* TAB 1: THEME & DISPLAY PREFERENCES */}
      {activeTab === 'THEME' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Card: Theme Mode Selection */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5 transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center font-bold">
                  {resolvedTheme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Chế Độ Hiển Thị (Color Theme)</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Lựa chọn giao diện trực quan phù hợp với điều kiện ánh sáng xung quanh
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Đang dùng: <strong className="uppercase">{theme}</strong> ({resolvedTheme === 'dark' ? 'Tối' : 'Sáng'})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {themeOptions.map((opt) => {
                const isSelected = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setTheme(opt.id)}
                    className={`relative text-left p-4 rounded-xl border-2 transition-all flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-xs border border-slate-200 dark:border-slate-700">
                          {opt.icon}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs">{opt.title}</h3>
                          <span className="text-[10px] text-slate-400 font-mono">mode: {opt.id}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {opt.desc}
                    </p>

                    {/* Miniature Theme Visual Swatch */}
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Hiệu ứng mắt:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {opt.id === 'light' ? 'Độ sáng cao' : opt.id === 'dark' ? 'Giảm ánh sáng xanh' : 'Tự thích ứng'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card: Display Enhancements & Accessibility */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5 transition-colors">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="w-9 h-9 bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center font-bold">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Tùy Chọn Hiển Thị & Mật Độ Dữ Liệu</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tinh chỉnh hiển thị danh sách thiết bị và độ tương phản SCADA
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* High Contrast Toggle */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
                <div className="space-y-0.5 max-w-[80%]">
                  <div className="flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">Độ tương phản cao (High Contrast)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Tăng cường độ đậm của đường viền và phân định trạng thái cho phòng điều hành.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHighContrast(!highContrast)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    highContrast ? 'bg-purple-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md"></div>
                </button>
              </div>

              {/* Compact Density Toggle */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
                <div className="space-y-0.5 max-w-[80%]">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">Bảng dữ liệu nén (Compact Density)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Giảm độ cao dòng để hiển thị nhiều thiết bị hơn trên một khung nhìn màn hình.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCompactDensity(!compactDensity)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    compactDensity ? 'bg-blue-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md"></div>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Live Theme Preview Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs">Xem Trước Trực Quan Giao Diện (Live Preview)</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Đồng bộ tức thì với CSS Class: "{resolvedTheme}"</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-3">
              {/* Mock Device Row Card */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">REC-471-TH</span>
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] rounded-full">
                        ĐANG ĐÓNG (ON)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Recloser 3 pha 24kV • Tuyến 471 E1.1 Thường Tín • Cột 32 ĐZ
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] flex items-center space-x-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">SCADA Online</span>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-700 dark:text-blue-300 font-semibold">
                    Pin 27.4V (Tốt)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROFILE & RBAC INFO */}
      {activeTab === 'PROFILE' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 transition-colors">
            <div className="flex items-center space-x-4 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{user?.full_name}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Tên đăng nhập: @{user?.username}</p>
                <div className="flex items-center space-x-2 mt-1.5">
                  <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded-full uppercase">
                    {user?.roles?.[0] || 'NHÂN VIÊN'}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Đơn vị: <strong>{user?.unit || 'EVN - NPC'}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Phạm Vi Quản Lý (Scope)</span>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {user?.scopes?.[0]?.scope_value || 'Toàn hệ thống (GLOBAL)'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Loại phân quyền: {user?.scopes?.[0]?.scope_type || 'SYSTEM'}
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Vai trò phân quyền</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {user?.roles?.map((r: string) => (
                    <span key={r} className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono text-[10px] font-bold rounded">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Session Management & Logout Section */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span>Phiên Đăng Nhập & Bảo Mật</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Đăng xuất an toàn khỏi tài khoản trên thiết bị này và xóa toàn bộ token xác thực cục bộ.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPasswordModalOpen(true)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center space-x-2 shrink-0 group"
              >
                <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition-colors" />
                <span>ĐỔI MẬT KHẨU</span>
              </button>
              <button
                type="button"
                onClick={() => setLogoutModalOpen(true)}
                className="px-5 py-2.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 font-bold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center space-x-2 shrink-0 group"
              >
                <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:text-white transition-colors" />
                <span>ĐĂNG XUẤT TÀI KHOẢN</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DANGER ZONE & BACKUP / RESTORE */}
      {activeTab === 'ADMIN' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {!isAdmin ? (
            <div className="p-8 text-center space-y-4 max-w-md mx-auto mt-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg">
              <ShieldAlert className="w-16 h-16 text-amber-500 mx-auto" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Khu Vực Quản Trị Cấp Cao</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Các chức năng Reset cơ sở dữ liệu lưới điện chỉ có hiệu lực với tài khoản Quản trị viên (ADMIN).
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Card: System Snapshot Backup & Restore (Admin only) */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-200 dark:border-blue-900/60 shadow-sm overflow-hidden transition-colors">
                <div className="bg-blue-50 dark:bg-blue-950/40 px-6 py-4 border-b border-blue-200 dark:border-blue-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold shadow-sm">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Sao Lưu & Khôi Phục Dữ Liệu Lưới Điện (Snapshot Backup & Restore)</h2>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Quản lý các điểm khôi phục dữ liệu, sao lưu thủ công và khôi phục bản gần nhất.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCreateBackupModalOpen(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow flex items-center gap-1.5"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>Tạo Bản Sao Lưu</span>
                    </button>
                    <button
                      onClick={handleOpenLatestBackupModal}
                      disabled={backupActionLoading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${backupActionLoading ? 'animate-spin' : ''}`} />
                      <span>Khôi Phục Gần Nhất</span>
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Danh Sách Các Bản Sao Lưu Hệ Thống ({backups.length})
                    </h3>
                    <button
                      onClick={loadBackups}
                      className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${backupsLoading ? 'animate-spin' : ''}`} />
                      <span>Làm mới danh sách</span>
                    </button>
                  </div>

                  {backupsLoading ? (
                    <div className="py-8 text-center text-xs text-slate-400">Đang tải danh sách sao lưu...</div>
                  ) : backups.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                      Chưa có bản sao lưu nào được ghi nhận.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                            <th className="p-3">ID / Tên bản sao lưu</th>
                            <th className="p-3">Loại</th>
                            <th className="p-3">Thống kê nhanh</th>
                            <th className="p-3">Người tạo</th>
                            <th className="p-3">Thời gian</th>
                            <th className="p-3 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {backups.map(b => (
                            <tr key={b.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                              <td className="p-3">
                                <div className="font-bold text-slate-900 dark:text-white">#{b.id} - {b.name}</div>
                                {b.notes && <div className="text-[11px] text-slate-500 italic truncate max-w-xs">{b.notes}</div>}
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                  b.backup_type === 'AUTO_BEFORE_RESET' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                                  b.backup_type === 'AUTO_BEFORE_RESTORE' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                                  'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                }`}>
                                  {b.backup_type}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                Thiết bị: {b.counts_summary?.devices || 0} | Trạm: {b.counts_summary?.stations || 0} | Tuyến: {b.counts_summary?.feeders || 0} | Vòng: {b.counts_summary?.loops || 0}
                              </td>
                              <td className="p-3 text-slate-700 dark:text-slate-300">{b.created_by_name || 'System'}</td>
                              <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                                {formatDateTime(b.created_at)}
                              </td>
                              <td className="p-3 text-right space-x-2">
                                <button
                                  onClick={() => handleRestoreSpecificBackup(b.id)}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] transition shadow"
                                >
                                  Khôi Phục
                                </button>
                                {b.backup_type !== 'SNAPSHOT' && (
                                  <button
                                    onClick={() => handleDeleteBackupItem(b.id)}
                                    className="px-2 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-red-600 hover:text-white text-slate-700 dark:text-slate-300 font-bold rounded-lg text-[11px] transition"
                                    title="Xóa bản sao lưu"
                                  >
                                    Xóa
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-red-200 dark:border-red-900/60 shadow-sm overflow-hidden space-y-0 transition-colors">
                <div className="bg-red-50 dark:bg-red-950/40 px-6 py-4 border-b border-red-200 dark:border-red-900/60 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-100 dark:bg-red-900/80 text-red-600 dark:text-red-300 rounded-xl flex items-center justify-center font-bold">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-red-900 dark:text-red-200">Khu Vực Nguy Hiểm (Danger Zone)</h2>
                      <p className="text-xs text-red-700 dark:text-red-400">Thao tác xóa và khôi phục dữ liệu chuyên sâu của hệ thống lưới điện.</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {/* Card 1: Reset All Loop Connections ONLY */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/50">
                    <div className="space-y-1 max-w-xl">
                      <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold rounded-md text-[10px] uppercase">
                        <Database className="w-3 h-3" />
                        <span>Khép Vòng & Topology</span>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">XÓA TOÀN BỘ DỮ LIỆU KHÉP VÒNG (GIỮ NGUYÊN TRẠM, TUYẾN & THIẾT BỊ)</h3>
                      <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                        Chỉ xóa sạch các mạch Khép vòng, sơ đồ Topology, liên kết A/B và lịch sử phê duyệt khép vòng. <strong>Trạm 110kV, Phát tuyến, Thiết bị và Tọa độ GIS được giữ nguyên 100%</strong> để bạn bắt đầu xây dựng lại Khép vòng mới.
                      </p>
                    </div>
                    <button
                      onClick={handleOpenLoopResetModal}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow transition flex items-center justify-center space-x-2 shrink-0 text-xs"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>RESET DỮ LIỆU KHÉP VÒNG</span>
                    </button>
                  </div>

                  {/* Card 2: Full System Grid Reset */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="space-y-1 max-w-xl">
                      <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-md text-[10px] uppercase">
                        <ShieldAlert className="w-3 h-3 text-red-600 dark:text-red-400" />
                        <span>Toàn Bộ Hệ Thống Lưới Điện</span>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">RESET TOÀN BỘ THIẾT BỊ, CÔNG VIỆC, PHÁT TUYẾN VÀ TRẠM 110KV</h3>
                      <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                        Đưa toàn bộ dữ liệu vận hành/lưới điện về trạng thái trống (0) để nhập lại từ đầu. Gỡ toàn bộ liên kết, topology, khép vòng và dọn dữ liệu mồ côi tự động trong Transaction. Tài khoản, Role, Permission, Scope, Nhân sự, Đơn vị và Audit Log được giữ nguyên tuyệt đối.
                      </p>
                    </div>
                    <button
                      onClick={handleOpenResetModal}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow transition flex items-center justify-center space-x-2 shrink-0 text-xs"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>RESET TOÀN BỘ LƯỚI ĐIỆN</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reset Modal / Wizard (2-Step confirmation + verification code + report) */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-200">
            {resetStep === 'STATS' && (
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">Bước 1: Thống Kê Dữ Liệu Sắp Xóa</h3>
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium">Kiểm kê số liệu hiện trạng trước khi Reset</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setResetModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {statsLoading ? (
                  <div className="py-12 text-center text-slate-500 flex items-center justify-center space-x-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Đang tải thống kê dữ liệu...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">Thiết bị</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{stats?.devices || 0}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">Công việc</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{stats?.work || 0}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">Phát tuyến</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{stats?.feeders || 0}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">Trạm 110kV</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{stats?.stations || 0}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">Topology</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{stats?.topology || 0}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">Khép vòng</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{stats?.loops || 0}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center col-span-2">
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">Liên kết & Quan hệ</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{stats?.links || 0}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setResetModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetStep('WARNING')}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition shadow flex items-center space-x-2"
                  >
                    <span>Tiếp tục: Xem Cảnh Báo</span>
                  </button>
                </div>
              </div>
            )}

            {resetStep === 'WARNING' && (
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">Bước 2: Cảnh Báo Quan Trọng</h3>
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium">Hành động không thể hoàn tác</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setResetModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-900 dark:text-red-200 p-4 rounded-xl space-y-3 text-xs leading-relaxed">
                  <p className="font-bold text-sm text-red-800 dark:text-red-300">
                    "Thao tác này sẽ xóa toàn bộ thiết bị, công việc, phát tuyến và trạm 110kV cùng các liên kết liên quan. Dữ liệu sau khi Reset có thể không khôi phục được."
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-red-700 dark:text-red-300">
                    <li>Tự động gỡ bỏ toàn bộ phụ thuộc foreign key, quan hệ trạm - phát tuyến - thiết bị.</li>
                    <li>Xóa sạch Topology, mạch khép vòng và dữ liệu GIS gắn với thiết bị/trạm/phát tuyến.</li>
                    <li>Chạy trong Transaction nguyên tử (Rollback nếu xảy ra bất kỳ lỗi nào).</li>
                  </ul>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-red-200 dark:border-red-900 text-emerald-800 dark:text-emerald-400 font-bold">
                    ✓ Giữ nguyên: Tài khoản người dùng, Admin, Role, Permission, Scope, Nhân sự, Đơn vị và Audit Logs.
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setResetStep('STATS')}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition"
                  >
                    Quay lại
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetStep('VERIFY')}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition shadow flex items-center space-x-2"
                  >
                    <span>Tiếp tục: Nhập Mã Xác Thực</span>
                  </button>
                </div>
              </div>
            )}

            {resetStep === 'VERIFY' && (
              <form onSubmit={handleExecuteReset} className="p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded-xl flex items-center justify-center">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">Bước 3: Mã Xác Thực Bảo Mật</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Yêu cầu xác thực cấp cao từ Server</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResetModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Mã xác thực hệ thống <span className="text-red-500">*</span>:
                    </label>
                    <input
                      type="password"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="Nhập mã xác thực..."
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:outline-none"
                      autoFocus
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Chỉ khi nhập chính xác mã hệ thống, nút Xác nhận Reset mới được kích hoạt.
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-3 rounded-xl text-xs font-bold flex items-center space-x-2">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setResetStep('WARNING')}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition"
                  >
                    Quay lại
                  </button>
                  <button
                    type="submit"
                    disabled={!verificationCode.trim() || loading}
                    className={`px-6 py-2.5 rounded-xl font-bold text-white transition shadow flex items-center space-x-2 ${
                      !verificationCode.trim() || loading
                        ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang xử lý Transaction...</span>
                      </>
                    ) : (
                      <span>XÁC NHẬN RESET</span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {resetStep === 'SUCCESS' && successReport && (
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">Báo Cáo Kết Quả Reset Hệ Thống</h3>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Toàn bộ dữ liệu vận hành đã được đưa về 0 thành công</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-xl space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300">
                    <span>Hạng mục dữ liệu</span>
                    <span>Trạng thái (Trước → Sau)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Thiết bị lưới điện:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{successReport.devices_before} → {successReport.devices_after}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Công việc & Lịch kiểm tra:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{successReport.work_before} → {successReport.work_after}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Phát tuyến (Feeders):</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{successReport.feeders_before} → {successReport.feeders_after}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Trạm 110kV:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{successReport.substations_before} → {successReport.substations_after}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Topology & Khép vòng:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">Nhiều → {successReport.topology_after}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Liên kết & Dữ liệu mồ côi:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">0 (Đã dọn sạch)</span>
                  </div>
                </div>

                <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 p-3 rounded-xl text-xs text-purple-900 dark:text-purple-300 font-bold flex items-center justify-between">
                  <span>Tài khoản, Role, Permission, Đơn vị, Audit Log:</span>
                  <span className="text-emerald-700 dark:text-emerald-400">KHÔNG BỊ ẢNH HƯỞNG</span>
                </div>

                <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleCloseAndReload}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow"
                  >
                    Hoàn Tất & Tải Lại Ứng Dụng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LOOP-ONLY RESET MODAL */}
      {loopResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-200">
            {loopResetStep === 'STATS' && (
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">Xóa Toàn Bộ Dữ Liệu Khép Vòng</h3>
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Bước 1/2: Kiểm kê số lượng Khép vòng sắp xóa</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setLoopResetModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {loopStatsLoading ? (
                  <div className="py-10 text-center text-slate-500 flex items-center justify-center space-x-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-amber-600" />
                    <span>Đang kiểm tra dữ liệu...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">Mạch Khép Vòng</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{loopStats?.loops || 0}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">Phiên Bản Topology</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{loopStats?.versions || 0}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">Nodes / Edges</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                          {(loopStats?.nodes || 0) + (loopStats?.edges || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3.5 space-y-1 text-xs text-emerald-900 dark:text-emerald-200">
                      <div className="flex items-center space-x-2 font-bold text-emerald-800 dark:text-emerald-300">
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Bảo toàn 100% dữ liệu lưới điện:</span>
                      </div>
                      <p className="text-emerald-700 dark:text-emerald-300 text-[11px] leading-relaxed pl-6">
                        • Trạm 110kV, Phát tuyến, Thiết bị và Tọa độ GPS <strong>KHÔNG BỊ XÓA</strong>.
                      </p>
                    </div>

                    <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-3.5 text-xs text-red-900 dark:text-red-200 space-y-1">
                      <p className="font-bold text-red-800 dark:text-red-300">Dữ liệu sẽ bị xóa hoàn toàn:</p>
                      <p className="text-red-700 dark:text-red-400 text-[11px]">
                        • Danh sách Khép vòng, cấu hình liên kết A/B, sơ đồ topology và yêu cầu phê duyệt.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setLoopResetModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition text-xs"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="button"
                    disabled={loopStatsLoading}
                    onClick={() => setLoopResetStep('CONFIRM')}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition shadow flex items-center space-x-2 text-xs disabled:opacity-50"
                  >
                    <span>Tiếp Tục: Xác Nhận</span>
                  </button>
                </div>
              </div>
            )}

            {loopResetStep === 'CONFIRM' && (
              <form onSubmit={handleExecuteLoopReset} className="p-6 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded-xl flex items-center justify-center font-bold">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">Xác Nhận Reset Khép Vòng</h3>
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Bước 2/2: Xác thực chuỗi bảo mật</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLoopResetModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-bold text-amber-800 dark:text-amber-300">Lưu ý quan trọng:</p>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                    Sau khi hoàn thành, bảng Khép vòng sẽ về 0. Bạn có thể định nghĩa lại các mạch khép vòng hoặc nhập từ file Excel mẫu.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Nhập đúng cụm từ <span className="text-red-600 dark:text-red-400 font-mono font-black">XÓA KHÉP VÒNG</span> để xác nhận:
                  </label>
                  <input
                    type="text"
                    required
                    value={loopVerificationText}
                    onChange={e => {
                      setLoopVerificationText(e.target.value);
                      setLoopErrorMsg(null);
                    }}
                    placeholder="XÓA KHÉP VÒNG"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-amber-300 dark:border-amber-700 focus:border-amber-600 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 font-mono font-bold text-sm tracking-wider focus:outline-none"
                    autoFocus
                  />
                  {loopErrorMsg && (
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400">{loopErrorMsg}</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setLoopResetStep('STATS')}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition text-xs"
                  >
                    Quay Lại
                  </button>

                  <button
                    type="submit"
                    disabled={
                      loopLoading ||
                      (loopVerificationText.trim().toUpperCase() !== 'XÓA KHÉP VÒNG' &&
                      loopVerificationText.trim().toUpperCase() !== 'XOA KHEP VONG')
                    }
                    className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-bold rounded-xl transition shadow flex items-center space-x-2 text-xs disabled:cursor-not-allowed"
                  >
                    {loopLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang xử lý...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>XÁC NHẬN RESET KHÉP VÒNG</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {loopResetStep === 'SUCCESS' && (
              <div className="p-6 space-y-6 text-center">
                <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-lg">Đã Reset Dữ Liệu Khép Vòng!</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Toàn bộ mạch Khép vòng và sơ đồ Topology cũ đã được xóa sạch. Hệ thống sẵn sàng cho mạch khép vòng mới.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3 text-xs text-left">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold block">Khép vòng đã xóa</span>
                    <span className="text-red-600 dark:text-red-400 font-mono font-bold text-sm">
                      {loopSuccessReport?.loops ?? loopStats?.loops ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold block">Phiên bản & Nodes/Edges</span>
                    <span className="text-red-600 dark:text-red-400 font-mono font-bold text-sm">
                      {(loopSuccessReport?.versions ?? 0) + (loopSuccessReport?.nodes ?? 0) + (loopSuccessReport?.edges ?? 0)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseAndReload}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow"
                >
                  Hoàn Tất & Tải Lại Dữ Liệu
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. Create Manual Backup Modal */}
      {createBackupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold shadow-sm">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Tạo Bản Sao Lưu Thủ Công</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Lưu lại toàn bộ trạng thái lưới điện hiện tại</p>
                </div>
              </div>
              <button
                onClick={() => setCreateBackupModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualBackupSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">Tên bản sao lưu (Tùy chọn)</label>
                <input
                  type="text"
                  value={manualBackupName}
                  onChange={e => setManualBackupName(e.target.value)}
                  placeholder={`Sao lưu hệ thống ${new Date().toLocaleDateString('vi-VN')}`}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">Ghi chú / Mô tả (Tùy chọn)</label>
                <textarea
                  rows={3}
                  value={manualBackupNotes}
                  onChange={e => setManualBackupNotes(e.target.value)}
                  placeholder="Ví dụ: Sao lưu trước khi import dữ liệu trạm mới..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 font-medium resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateBackupModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition text-xs"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={backupActionLoading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow text-xs flex items-center space-x-2 disabled:opacity-50"
                >
                  {backupActionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Tạo Sao Lưu Ngay</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Latest Backup / 1-Click Restore Review Modal */}
      {latestBackupModalOpen && latestBackupData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-emerald-200 dark:border-emerald-900 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-900 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold shadow-sm">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Khôi Phục Dữ Liệu Gần Nhất (1-Click)</h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">Kiểm tra thông tin bản sao lưu trước khi khôi phục</p>
                </div>
              </div>
              <button
                onClick={() => setLatestBackupModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold">Mã bản sao lưu:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">#{latestBackupData.backup.id} - {latestBackupData.backup.name}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold">Thời điểm tạo:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{formatDateTime(latestBackupData.backup.created_at)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold">Loại sao lưu:</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{latestBackupData.backup.backup_type}</span>
                </div>
                {latestBackupData.backup.notes && (
                  <div className="text-xs pt-1 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                    <span className="font-bold">Ghi chú:</span> {latestBackupData.backup.notes}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">So sánh số liệu lưu trữ trong bản sao lưu:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Thiết bị</span>
                    <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-base">{latestBackupData.backup.counts_summary?.devices || 0}</span>
                  </div>
                  <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Trạm 110kV</span>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-base">{latestBackupData.backup.counts_summary?.stations || 0}</span>
                  </div>
                  <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Phát tuyến</span>
                    <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-base">{latestBackupData.backup.counts_summary?.feeders || 0}</span>
                  </div>
                  <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Khép vòng</span>
                    <span className="font-mono font-black text-purple-600 dark:text-purple-400 text-base">{latestBackupData.backup.counts_summary?.loops || 0}</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-bold text-amber-800 dark:text-amber-300">Lưu ý khi khôi phục:</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Hệ thống sẽ tự động tạo một bản lưu an toàn (Auto backup before restore) trước khi ghi đè dữ liệu. Toàn bộ trạng thái lưới điện hiện tại sẽ được thay thế bằng dữ liệu từ bản sao lưu gần nhất.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setLatestBackupModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition text-xs"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  disabled={backupActionLoading}
                  onClick={handleRestoreLatestBackup}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow text-xs flex items-center space-x-2 disabled:opacity-50"
                >
                  {backupActionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Xác Nhận Khôi Phục Ngay</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Restore Success Report Modal */}
      {restoreResultModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-emerald-200 dark:border-emerald-900 shadow-2xl overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 rounded-2xl mx-auto flex items-center justify-center">
                <Check className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Khôi Phục Dữ Liệu Thành Công!</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {restoreResultModal.message || 'Hệ thống đã phục hồi trạng thái thành công từ điểm sao lưu.'}
                </p>
              </div>

              {restoreResultModal.restored_counts && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3 text-xs text-left">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Thiết bị phục hồi</span>
                    <span className="text-emerald-600 font-mono font-bold text-sm">
                      {restoreResultModal.restored_counts.devices || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Trạm 110kV</span>
                    <span className="text-emerald-600 font-mono font-bold text-sm">
                      {restoreResultModal.restored_counts.stations || 0}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setRestoreResultModal(null);
                  window.location.reload();
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow"
              >
                Hoàn Tất & Tải Lại Ứng Dụng
              </button>
            </div>
          </div>
        </div>
      )}

      <LogoutModal isOpen={logoutModalOpen} onClose={() => setLogoutModalOpen(false)} />
      {user && (
        <ChangePasswordModal 
          isOpen={passwordModalOpen} 
          onClose={() => setPasswordModalOpen(false)} 
          userId={user.id}
          isAdmin={isAdmin || false}
        />
      )}
    </div>
  );
};
