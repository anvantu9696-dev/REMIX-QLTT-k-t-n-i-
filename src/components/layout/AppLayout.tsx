import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Zap,
  Building2,
  GitCommitHorizontal,
  CircleDot,
  MapPin,
  Briefcase,
  CheckSquare,
  AlertTriangle,
  FileBarChart,
  Upload,
  FileText,
  Bell,
  Users,
  BookOpen,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  ChevronDown,
  UserCheck,
  Eye,
  Activity,
  Sun,
  Moon,
  Search,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../lib/api';
import { NotificationCenter } from '../NotificationCenter';
import { LogoutModal } from '../common/LogoutModal';
import { LiveClockWidget } from '../common/LiveClockWidget';
import { Notification as AppNotification, RoleCode, Device } from '../../types';
import { BackButton } from './BackButton';

interface AppLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  rolesAllowed?: ('ADMIN' | 'MANAGER' | 'SHIFT_LEADER' | 'STAFF' | 'VIEWER')[];
  hideForGuest?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ currentPath, onNavigate, children }) => {
  const { user, logout, hasRole, isGuest, isRealAdmin } = useAuth();
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Device[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!globalSearch.trim() || globalSearch.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setShowResults(true);
      try {
        const response = await api.getDevices({ search: globalSearch.trim(), limit: 6 });
        if (response.success) {
          setSearchResults(response.data as Device[]);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [globalSearch]);

  const menuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, path: '/' },
    // { id: 'gis-map', label: 'Bản đồ thiết bị', icon: <MapPin className="w-4 h-4" />, path: '/gis-map' },
    { id: 'equipment', label: 'Thiết bị', icon: <Zap className="w-4 h-4" />, path: '/equipment', rolesAllowed: ['ADMIN', 'MANAGER', 'SHIFT_LEADER', 'STAFF'] },
    { id: 'stations', label: 'Trạm 110kV', icon: <Building2 className="w-4 h-4" />, path: '/stations' },
    { id: 'feeders', label: 'Phát tuyến', icon: <GitCommitHorizontal className="w-4 h-4" />, path: '/feeders' },
    { id: 'loops', label: 'Khép vòng', icon: <CircleDot className="w-4 h-4" />, path: '/loops' },
    { id: 'approvals', label: 'Phê duyệt', icon: <ShieldAlert className="w-4 h-4" />, path: '/approvals' },
    { id: 'tasks', label: 'Công việc & Kiểm tra', icon: <Briefcase className="w-4 h-4" />, path: '/tasks', rolesAllowed: ['ADMIN', 'MANAGER', 'SHIFT_LEADER', 'STAFF'] },
    { id: 'my-proposals', label: 'Đề xuất của tôi', icon: <FileText className="w-4 h-4" />, path: '/my-proposals', rolesAllowed: ['ADMIN', 'MANAGER', 'SHIFT_LEADER', 'STAFF'] },
    { id: 'anomalies', label: 'Bất thường', icon: <AlertTriangle className="w-4 h-4" />, path: '/anomalies' },
    { id: 'reports', label: 'Báo cáo', icon: <FileBarChart className="w-4 h-4" />, path: '/reports', rolesAllowed: ['ADMIN', 'MANAGER', 'SHIFT_LEADER', 'STAFF'] },
    { id: 'import', label: 'Import dữ liệu', icon: <Upload className="w-4 h-4" />, path: '/import', rolesAllowed: ['ADMIN'] },
    { id: 'documents', label: 'Tài liệu', icon: <FileText className="w-4 h-4" />, path: '/documents', rolesAllowed: ['ADMIN', 'MANAGER', 'SHIFT_LEADER', 'STAFF'] },
    { id: 'users', label: 'Người dùng', icon: <Users className="w-4 h-4" />, path: '/users', rolesAllowed: ['ADMIN'] },
    { id: 'guides', label: 'Hướng dẫn', icon: <BookOpen className="w-4 h-4" />, path: '/guides' },
    { id: 'settings', label: 'Cài đặt', icon: <Settings className="w-4 h-4" />, path: '/settings' }
  ];

  const visibleMenuItems = menuItems.filter(item => {
    if (!user) return false;
    if (item.hideForGuest && isGuest()) return false;
    if (item.rolesAllowed && item.rolesAllowed.length > 0) {
      const hasAllowedRole = user.roles?.some(r => item.rolesAllowed!.includes(r));
      if (!hasAllowedRole) return false;
    }
    if (item.rolesAllowed) return item.rolesAllowed.some(r => hasRole(r as any));
    return true;
  });

  const getUserInitials = () => {
    if (!user?.full_name) return 'VA';
    const parts = user.full_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return user.full_name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Navigation - Styled according to PowerGrid 1.0 Design Variation */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-[#0f172a] text-slate-400 border-r border-slate-800/80 flex flex-col shrink-0 transform transition-transform duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand Header */}
        <div className="px-6 py-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => onNavigate('/')}>
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <div className="min-w-0">
              <span className="text-white font-bold tracking-tight text-sm leading-tight block truncate">
                POWERGRID 1.0
              </span>
              <span className="text-slate-400 text-[10px] font-mono block">
                EVN GRID OPS
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {/* Group 1: CHÍNH */}
          <div className="space-y-1">
            <div className="px-3 mb-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
              Chính
            </div>
            {[
              { id: 'dashboard', label: 'Dashboard', path: '/' },
              // { id: 'gis-map', label: 'Bản đồ thiết bị', path: '/gis-map' }
            ].map(item => {
              const menuItem = visibleMenuItems.find(m => m.id === item.id);
              if (!menuItem) return null;
              const isActive = currentPath === menuItem.path || (menuItem.path !== '/' && currentPath.startsWith(menuItem.path));
              return (
                <button
                  key={menuItem.id}
                  onClick={() => { onNavigate(menuItem.path); setMobileOpen(false); }}
                  className={`w-full flex items-center px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-sm font-bold' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="w-4 h-4 mr-3 flex items-center justify-center opacity-90">{menuItem.icon}</span>
                  <span>{menuItem.label}</span>
                </button>
              );
            })}
          </div>

          {/* Group 2: QUẢN LÝ LƯỚI */}
          <div className="space-y-1">
            <div className="px-3 mb-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
              Quản lý lưới
            </div>
            {[
              { id: 'equipment', label: 'Thiết bị' },
              { id: 'stations', label: 'Trạm 110kV' },
              { id: 'feeders', label: 'Phát tuyến' },
              { id: 'loops', label: 'Khép vòng' }
            ].map(item => {
              const menuItem = visibleMenuItems.find(m => m.id === item.id);
              if (!menuItem) return null;
              const isActive = currentPath === menuItem.path || (menuItem.path !== '/' && currentPath.startsWith(menuItem.path));
              return (
                <button
                  key={menuItem.id}
                  onClick={() => { onNavigate(menuItem.path); setMobileOpen(false); }}
                  className={`w-full flex items-center px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-sm font-bold' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="w-4 h-4 mr-3 flex items-center justify-center opacity-90">{menuItem.icon}</span>
                  <span>{menuItem.label}</span>
                </button>
              );
            })}
          </div>

          {/* Group 3: VẬN HÀNH */}
          <div className="space-y-1">
            <div className="px-3 mb-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
              Vận hành
            </div>
            {[
              { id: 'tasks', label: 'Công việc & Kiểm tra' },
              { id: 'anomalies', label: 'Bất thường' },
              { id: 'approvals', label: 'Phê duyệt' },
              { id: 'my-proposals', label: 'Đề xuất của tôi' }
            ].map(item => {
              const menuItem = visibleMenuItems.find(m => m.id === item.id);
              if (!menuItem) return null;
              const isActive = currentPath === menuItem.path || (menuItem.path !== '/' && currentPath.startsWith(menuItem.path));
              return (
                <button
                  key={menuItem.id}
                  onClick={() => { onNavigate(menuItem.path); setMobileOpen(false); }}
                  className={`w-full flex items-center px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-sm font-bold' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="w-4 h-4 mr-3 flex items-center justify-center opacity-90">{menuItem.icon}</span>
                  <span>{menuItem.label}</span>
                </button>
              );
            })}
          </div>

          {/* Group 4: HỆ THỐNG & BÁO CÁO */}
          <div className="space-y-1">
            <div className="px-3 mb-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
              Hệ thống
            </div>
            {[
              { id: 'reports', label: 'Báo cáo' },
              { id: 'import', label: 'Import dữ liệu' },
              { id: 'users', label: 'Người dùng' },
              { id: 'documents', label: 'Tài liệu' },
              { id: 'settings', label: 'Cài đặt' }
            ].map(item => {
              const menuItem = visibleMenuItems.find(m => m.id === item.id);
              if (!menuItem) return null;
              const isActive = currentPath === menuItem.path || (menuItem.path !== '/' && currentPath.startsWith(menuItem.path));
              return (
                <button
                  key={menuItem.id}
                  onClick={() => { onNavigate(menuItem.path); setMobileOpen(false); }}
                  className={`w-full flex items-center px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-sm font-bold' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="w-4 h-4 mr-3 flex items-center justify-center opacity-90">{menuItem.icon}</span>
                  <span>{menuItem.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Sidebar Footer User Info & Logout */}
        <div className="p-3 bg-slate-950/90 border-t border-white/5">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
              {getUserInitials()}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.full_name || 'Người dùng'}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-tight truncate font-mono">
                {user?.roles?.[0] || 'USER'} • {user?.unit?.replace('Công ty Điện lực ', 'ĐL ') || 'EVN'}
              </p>
            </div>
            <button
              onClick={() => setIsLogoutModalOpen(true)}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#f8fafc] dark:bg-slate-950">
        {/* Top Header matching Design Variation */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-8 shrink-0 transition-colors gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-xl min-w-0">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Design Variation Search Container */}
            <div className="relative flex-1 max-w-[400px]" ref={searchRef}>
              <div className="flex items-center bg-[#f1f5f9] dark:bg-slate-800 px-3.5 py-2 rounded-lg gap-2.5 border border-slate-200/80 dark:border-slate-700/80 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  onFocus={() => globalSearch.trim().length >= 2 && setShowResults(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && globalSearch.trim()) {
                      onNavigate(`/equipment?search=${encodeURIComponent(globalSearch.trim())}`);
                      setShowResults(false);
                    }
                  }}
                  placeholder="Tìm kiếm thiết bị, trụ, phát tuyến..."
                  className="bg-transparent border-none outline-none text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 w-full"
                />
                {isSearching && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />}
                {globalSearch && (
                  <button 
                    onClick={() => { setGlobalSearch(''); setShowResults(false); }}
                    className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                  >
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>

              {/* Global Search Results Dropdown */}
              {showResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <span>Kết quả tìm kiếm</span>
                    {searchResults.length > 0 && <span className="text-blue-500">{searchResults.length} thiết bị</span>}
                  </div>
                  
                  <div className="max-h-[360px] overflow-y-auto">
                    {isSearching && searchResults.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
                        <p className="text-xs text-slate-500">Đang tìm kiếm dữ liệu...</p>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <>
                        {searchResults.map((device) => (
                          <button
                            key={device.id}
                            onClick={() => {
                              onNavigate(`/equipment/detail/${device.id}`);
                              setShowResults(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-800/50 last:border-none group"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <Zap className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {device.name}
                                  </span>
                                  <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                                    {device.device_id}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate">
                                    {device.substation_name || 'Không rõ trạm'} • {device.feeder_name || 'Không rõ phát tuyến'}
                                  </span>
                                </div>
                                {device.pole_number && (
                                  <div className="text-[10px] text-slate-400 mt-0.5 italic">
                                    Vị trí trụ: {device.pole_number}
                                  </div>
                                )}
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors self-center" />
                            </div>
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            onNavigate(`/equipment?search=${encodeURIComponent(globalSearch.trim())}`);
                            setShowResults(false);
                          }}
                          className="w-full text-center py-2 text-[11px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors border-t border-slate-100 dark:border-slate-800 mt-1"
                        >
                          Xem tất cả kết quả cho "{globalSearch}"
                        </button>
                      </>
                    ) : (
                      <div className="px-4 py-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                          <Search className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Không tìm thấy thiết bị</p>
                        <p className="text-xs text-slate-400 mt-1">Vui lòng thử từ khóa khác hoặc kiểm tra lại ID</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Live Clock & Calendar Widget */}
            <LiveClockWidget variant="header" />

            {/* Live Sync Status & ID Badge */}
            <div className="text-right hidden xl:block">
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>ĐỒNG BỘ: LIVE</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                ID: {user?.username?.toUpperCase() || 'ADMIN-8821'}
              </div>
            </div>



            {/* Dark / Light Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={resolvedTheme === 'dark' ? 'Chuyển sang Chế độ Sáng' : 'Chuyển sang Chế độ Tối'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* Notification Bell */}
            <NotificationCenter />

            {/* User Initials Avatar matching design */}
            <div 
              onClick={() => onNavigate('/settings')}
              className="w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center text-xs shadow-sm cursor-pointer uppercase transition-colors"
              title={user?.full_name || 'Hồ sơ người dùng'}
            >
              {getUserInitials()}
            </div>
          </div>
        </header>

        {/* Viewport Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto flex flex-col">
          {currentPath !== '/' && <BackButton onBack={() => window.history.back()} />}
          {children}
        </div>
      </main>

      <LogoutModal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} />
    </div>
  );
};
