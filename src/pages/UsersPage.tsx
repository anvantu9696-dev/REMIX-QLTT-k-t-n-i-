import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Lock,
  Unlock,
  Ban,
  Trash2,
  Edit,
  Shield,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  UserCheck,
  Building,
  Briefcase,
  X,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { User, RoleCode, ScopeType, UserScope } from '../types';
import { formatDateTime } from '../utils/dateTime';

export const UsersPage: React.FC = () => {
  const { user: currentUser, hasPermission, isGuest } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailModalUser, setDetailModalUser] = useState<User | null>(null);

  // Approval & Rejection Modals
  const [approveModalUser, setApproveModalUser] = useState<User | null>(null);
  const [approveRole, setApproveRole] = useState<RoleCode>('FIELD_OPERATOR');
  const [approveUnit, setApproveUnit] = useState('');
  const [approveTeam, setApproveTeam] = useState('');
  const [approveTitle, setApproveTitle] = useState('');

  const [rejectModalUser, setRejectModalUser] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState('Thông tin đăng ký chưa chính xác hoặc chưa được xác nhận bởi đơn vị.');

  // Form State
  const [formData, setFormData] = useState({
    id: 0,
    employee_code: '',
    full_name: '',
    username: '',
    email: '',
    phone: '',
    unit: 'Công ty Điện lực Hà Nội',
    team: 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
    title: 'Kỹ thuật viên Vận hành',
    password: '',
    roles: ['FIELD_OPERATOR'] as RoleCode[],
    scopes: [{ scope_type: 'DOI' as ScopeType, scope_value: 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN' }]
  });

  const [formErr, setFormErr] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    // Log authentication and permission status on load
    const token = localStorage.getItem('grid_auth_token') || localStorage.getItem('token');
    
    // Decode JWT payload if possible to verify claims directly from token
    let decodedTokenClaims: any = null;
    if (token && token.split('.').length === 3) {
      try {
        const payloadBase64 = token.split('.')[1];
        const decodedJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
        decodedTokenClaims = JSON.parse(decodedJson);
      } catch (e) {
        console.warn('[TOKEN DECODE WARNING] Could not parse JWT token payload:', e);
      }
    }

    const tokenRoles = decodedTokenClaims?.roles || decodedTokenClaims?.role || currentUser?.roles || [];
    const tokenScopes = decodedTokenClaims?.scopes || decodedTokenClaims?.scope || currentUser?.scopes || [];

    const hasAdminRoleInToken = Array.isArray(tokenRoles) ? tokenRoles.includes('ADMIN') : tokenRoles === 'ADMIN';
    const hasToanHeThongScopeInToken = Array.isArray(tokenScopes) 
      ? tokenScopes.some((s: any) => typeof s === 'string' ? (s === 'TOAN_HE_THONG' || s === 'SYSTEM') : (s?.scope_value === 'TOAN_HE_THONG' || s?.scope_type === 'SYSTEM'))
      : (tokenScopes === 'TOAN_HE_THONG');

    const hasAdminRole = hasAdminRoleInToken || currentUser?.roles?.includes('ADMIN') || false;
    const hasToanHeThongScope = hasToanHeThongScopeInToken || currentUser?.scopes?.some(s => s.scope_type === 'SYSTEM' || s.scope_value === 'TOAN_HE_THONG') || hasAdminRole;
    const canReadUsers = hasPermission('users:read') || hasAdminRole;

    console.log('================ [TOKEN CLAIM VERIFICATION] ================');
    console.log('[TOKEN CLAIM] Raw Token present:', !!token);
    console.log('[TOKEN CLAIM] Decoded Token Claims Payload:', decodedTokenClaims);
    console.log('[TOKEN CLAIM] Verified Claim Role contains "ADMIN":', hasAdminRoleInToken);
    console.log('[TOKEN CLAIM] Verified Claim Scope contains "TOAN_HE_THONG":', hasToanHeThongScopeInToken);
    console.log('[TOKEN CLAIM] Current User object fallback:', currentUser ? {
      username: currentUser.username,
      roles: currentUser.roles,
      scopes: currentUser.scopes
    } : 'Not logged in');
    console.log('[TOKEN CLAIM] Final Admin Role status:', hasAdminRole);
    console.log('[TOKEN CLAIM] Final Toan He Thong Scope status:', hasToanHeThongScope);
    console.log('===========================================================');

    if (!token) {
      console.warn('[USER AUTH DEBUG] WARNING: No auth token found in localStorage. API calls may return 401 Unauthorized.');
    }
    if (!canReadUsers) {
      console.warn('[USER AUTH DEBUG] WARNING: User does not have "users:read" permission. API calls may return 403 Forbidden.');
    }

    fetchUsers();
    fetchRoles();
  }, [search, roleFilter, statusFilter]);

  const fetchRoles = async () => {
    try {
      const res = await api.getRolesAndPermissions();
      if (res.success && res.roles) {
        setAvailableRoles(res.roles.filter((r: any) => !r.status || r.status === 'ACTIVE'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    const token = localStorage.getItem('grid_auth_token') || localStorage.getItem('token');
    const authHeader = token ? `Bearer ${token}` : 'None';

    // Temporary diagnostic flag to bypass all UI-side filters and pagination parameters
    const DIAGNOSTIC_BYPASS_FILTERS = true;
    const query = DIAGNOSTIC_BYPASS_FILTERS ? '' : new URLSearchParams({
      ...(search ? { search } : {}),
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }).toString();
    const fullUrl = `${window.location.origin}/api/users${query ? '?' + query : ''}`;

    console.log('================ [GRANULAR USER DIAGNOSTIC] BEFORE API CALL ================');
    console.log('[USER DIAGNOSTIC] Full Endpoint URL:', fullUrl);
    console.log('[USER DIAGNOSTIC] Authorization Header:', authHeader);
    console.log('[USER DIAGNOSTIC] DIAGNOSTIC_BYPASS_FILTERS enabled:', DIAGNOSTIC_BYPASS_FILTERS);
    console.log('===========================================================================');

    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      const statusCode = response.status;
      const rawText = await response.text();

      console.log('================ [GRANULAR USER DIAGNOSTIC] AFTER API CALL ================');
      console.log('[USER DIAGNOSTIC] Exact HTTP Status Code Received:', statusCode);
      console.log('[USER DIAGNOSTIC] Raw JSON Response Body:', rawText);

      let res: any;
      try {
        res = rawText ? JSON.parse(rawText) : {};
      } catch (parseErr) {
        console.error('[USER DIAGNOSTIC] JSON Parse Error:', parseErr);
        res = { success: false, data: [] };
      }

      console.log('[USER DIAGNOSTIC] Parsed Response Object:', res);

      // Check response structure for 'items', 'data', or 'users' keys
      const hasDataKey = Array.isArray(res?.data);
      const hasItemsKey = Array.isArray(res?.items);
      const hasUsersKey = Array.isArray(res?.users);
      const isDirectArray = Array.isArray(res);

      console.log('[USER DIAGNOSTIC Key Check] Contains "data" key (array):', hasDataKey, hasDataKey ? res.data.length : 0);
      console.log('[USER DIAGNOSTIC Key Check] Contains "items" key (array):', hasItemsKey, hasItemsKey ? res.items.length : 0);
      console.log('[USER DIAGNOSTIC Key Check] Contains "users" key (array):', hasUsersKey, hasUsersKey ? res.users.length : 0);
      console.log('[USER DIAGNOSTIC Key Check] Is Direct Array:', isDirectArray, isDirectArray ? res.length : 0);
      console.log('===========================================================================');

      if (response.ok && (res && (res.success !== false))) {
        const resolvedUsers = isDirectArray 
          ? res 
          : (hasDataKey ? res.data : (hasItemsKey ? res.items : (hasUsersKey ? res.users : [])));
        
        console.log('[USER MANAGEMENT DEBUG] Resolved Users Count:', resolvedUsers?.length || 0);
        setUsers(resolvedUsers || []);
      } else {
        console.warn('[USER MANAGEMENT DEBUG] GET /users returned success: false or unexpected format', res);
        setUsers([]);
      }
    } catch (err: any) {
      console.error('[USER MANAGEMENT DEBUG] GET /users API Error caught:', {
        message: err.message,
        status: err.status,
        data: err.data
      });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    const nextEmpCode = `NV-${Math.floor(10000 + Math.random() * 90000)}`;
    setFormData({
      id: 0,
      employee_code: nextEmpCode,
      full_name: '',
      username: '',
      email: '',
      phone: '',
      unit: 'Công ty Điện lực Hà Nội',
      team: 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      title: 'Kỹ thuật viên Vận hành',
      password: 'password123',
      roles: ['FIELD_OPERATOR'],
      scopes: [{ scope_type: 'DOI', scope_value: 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN' }]
    });
    setFormErr(null);
    setFormSuccess(null);
    setAddModalOpen(true);
  };

  const handleOpenEditModal = (targetUser: User) => {
    setFormData({
      id: targetUser.id,
      employee_code: targetUser.employee_code,
      full_name: targetUser.full_name,
      username: targetUser.username,
      email: targetUser.email,
      phone: targetUser.phone || '',
      unit: targetUser.unit,
      team: targetUser.team,
      title: targetUser.title,
      password: '', // blank unless changing
      roles: (targetUser.roles || []) as RoleCode[],
      scopes: (targetUser.scopes || [{ scope_type: 'SYSTEM', scope_value: 'TOAN_HE_THONG' }]) as UserScope[]
    });
    setFormErr(null);
    setFormSuccess(null);
    setEditModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFormErr(null);
    setFormSuccess(null);

    try {
      const res = await api.createUser(formData);
      setFormSuccess(res.message);
      setTimeout(() => {
        setAddModalOpen(false);
        fetchUsers();
      }, 1200);
    } catch (err: any) {
      setFormErr(err.message || 'Tạo người dùng thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFormErr(null);
    setFormSuccess(null);

    try {
      const res = await api.updateUser(formData.id, formData);
      setFormSuccess(res.message);
      setTimeout(() => {
        setEditModalOpen(false);
        fetchUsers();
      }, 1200);
    } catch (err: any) {
      setFormErr(err.message || 'Cập nhật thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (userId: number, newStatus: 'ACTIVE' | 'LOCKED' | 'DISABLED') => {
    if (!window.confirm(`Bạn có chắc chắn muốn chuyển trạng thái tài khoản sang ${newStatus}?`)) return;

    try {
      const res = await api.updateUserStatus(userId, newStatus);
      alert(res.message);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Thao tác thất bại');
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!window.confirm(`XÁC NHẬN XÓA MỀM (Soft Delete) tài khoản [${username}]? Dữ liệu vẫn được lưu trong database dưới dạng khôi phục được.`)) return;

    try {
      const res = await api.deleteUser(userId);
      alert(res.message);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Xóa tài khoản thất bại');
    }
  };

  const handleRoleToggle = (roleCode: RoleCode) => {
    setFormData(prev => {
      const exists = prev.roles.includes(roleCode);
      const newRoles = exists ? prev.roles.filter(r => r !== roleCode) : [...prev.roles, roleCode];
      return { ...prev, roles: newRoles };
    });
  };

  const handleOpenApproveModal = (targetUser: User) => {
    setApproveModalUser(targetUser);
    setApproveRole((targetUser.roles?.[0] as RoleCode) || 'FIELD_OPERATOR');
    setApproveUnit(targetUser.unit || 'Công ty Điện lực');
    setApproveTeam(targetUser.team || 'Đội Vận hành Lưới điện');
    setApproveTitle(targetUser.title || 'Chuyên viên Vận hành');
  };

  const handleConfirmApprove = async () => {
    if (!approveModalUser) return;
    setActionLoading(true);
    try {
      const res = await api.approveUser(approveModalUser.id, {
        role: approveRole,
        roles: [approveRole],
        unit: approveUnit,
        team: approveTeam,
        title: approveTitle,
        scopes: [{ scope_type: 'DON_VI', scope_value: approveUnit }]
      });
      alert(res.message || 'Phê duyệt thành công');
      setApproveModalUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Phê duyệt thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenRejectModal = (targetUser: User) => {
    setRejectModalUser(targetUser);
    setRejectReason('Thông tin đăng ký chưa chính xác hoặc chưa được xác nhận bởi đơn vị.');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalUser) return;
    setActionLoading(true);
    try {
      const res = await api.rejectUser(rejectModalUser.id, rejectReason);
      alert(res.message || 'Đã từ chối tài khoản');
      setRejectModalUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Thao tác thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            ĐANG HOẠT ĐỘNG
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            CHỜ PHÊ DUYỆT
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            ĐÃ TỪ CHỐI
          </span>
        );
      case 'LOCKED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
            <Lock className="w-3 h-3 text-slate-600" />
            TẠM KHÓA
          </span>
        );
      case 'DISABLED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
            <Ban className="w-3 h-3 text-red-600" />
            VÔ HIỆU HÓA
          </span>
        );
      default:
        return <span className="text-xs text-slate-500 font-medium">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Quản lý Người dùng & Phân quyền Tài khoản
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Quản trị danh sách nhân sự, khởi tạo tài khoản, khóa/mở khóa, gán Vai trò (RBAC) và Phạm vi làm việc (Scope).
          </p>
        </div>

        {hasPermission('users:create') && !isGuest() && (
          <button
            onClick={handleOpenAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-600/30 transition-all flex items-center space-x-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Tài khoản Mới</span>
          </button>
        )}
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              statusFilter === '' 
                ? 'bg-slate-900 text-white shadow-sm' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({users.length})
          </button>

          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Chờ Duyệt</span>
            {users.filter(u => u.status === 'PENDING').length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                statusFilter === 'PENDING' ? 'bg-white text-amber-700' : 'bg-amber-600 text-white'
              }`}>
                {users.filter(u => u.status === 'PENDING').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            Đang hoạt động ({users.filter(u => u.status === 'ACTIVE').length})
          </button>

          <button
            onClick={() => setStatusFilter('LOCKED')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              statusFilter === 'LOCKED'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tạm khóa ({users.filter(u => u.status === 'LOCKED').length})
          </button>

          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              statusFilter === 'REJECTED'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            Từ chối ({users.filter(u => u.status === 'REJECTED').length})
          </button>

          <button
            onClick={() => setStatusFilter('DISABLED')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              statusFilter === 'DISABLED'
                ? 'bg-red-700 text-white shadow-sm'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            Vô hiệu hóa ({users.filter(u => u.status === 'DISABLED').length})
          </button>
        </div>

        {/* Search & Role Filter */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo Tên, Username, Mã NV, Email, Đơn vị..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-transparent text-slate-700 font-semibold focus:outline-none"
              >
                <option value="">Tất cả Role</option>
                <option value="ADMIN">ADMIN</option>
                <option value="CAN_BO_PHUONG_THUC">CÁN BỘ PHƯƠNG THỨC</option>
                <option value="TRUONG_CA">TRƯỞNG CA</option>
                <option value="PHO_CA">PHÓ CA</option>
                <option value="DOI_TRUONG">ĐỘI TRƯỞNG</option>
                <option value="NHAN_VIEN_VAN_HANH">NHÂN VIÊN VẬN HÀNH</option>
                <option value="FIELD_OPERATOR">NHÂN VIÊN HIỆN TRƯỜNG</option>
                <option value="KHACH">KHÁCH</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-4">Mã NV / Họ Tên</th>
                <th className="p-4">Tài khoản & Liên hệ</th>
                <th className="p-4">Đơn vị & Chức danh</th>
                <th className="p-4">Nhóm Quyền (Role)</th>
                <th className="p-4">Scope Phạm vi</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Đang tải dữ liệu người dùng từ database...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Không tìm thấy người dùng phù hợp với bộ lọc
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-semibold text-slate-900">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {u.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{u.full_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">Code: {u.employee_code}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <p className="font-semibold text-slate-800">{u.username}</p>
                      <p className="text-[11px] text-slate-500">{u.email}</p>
                    </td>

                    <td className="p-4 text-slate-700">
                      <p className="font-medium text-slate-800">{u.title}</p>
                      <p className="text-[11px] text-slate-400">{u.unit} - {u.team}</p>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {u.roles?.map((r) => (
                          <span
                            key={r}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              r === 'ADMIN' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-4 text-slate-600">
                      <div className="text-[11px] font-medium space-y-0.5">
                        {u.scopes?.map((s, idx) => (
                          <span key={idx} className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 mr-1 mb-1">
                            {s.scope_type}: {s.scope_value}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-4">
                      {getStatusBadge(u.status)}
                    </td>

                    <td className="p-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => setDetailModalUser(u)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                        title="Xem chi tiết hồ sơ"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* For PENDING users: show Approve & Reject buttons */}
                      {u.status === 'PENDING' && hasPermission('users:update') && !isGuest() && (
                        <>
                          <button
                            onClick={() => handleOpenApproveModal(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                            title="Phê duyệt kích hoạt tài khoản"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Duyệt</span>
                          </button>

                          <button
                            onClick={() => handleOpenRejectModal(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg"
                            title="Từ chối tài khoản"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Từ chối</span>
                          </button>
                        </>
                      )}

                      {/* For REJECTED users: allow re-approving */}
                      {u.status === 'REJECTED' && hasPermission('users:update') && !isGuest() && (
                        <button
                          onClick={() => handleOpenApproveModal(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg"
                          title="Xem xét lại & Phê duyệt"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Duyệt lại</span>
                        </button>
                      )}

                      {/* For ACTIVE/LOCKED users: allow Edit */}
                      {u.status !== 'PENDING' && hasPermission('users:update') && !isGuest() && (
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg"
                          title="Chỉnh sửa / Gán Role & Scope"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}

                      {hasPermission('users:lock') && !isGuest() && u.id !== currentUser?.id && u.status !== 'PENDING' && u.status !== 'REJECTED' && (
                        u.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleStatusChange(u.id, 'LOCKED')}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg"
                            title="Tạm khóa tài khoản"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(u.id, 'ACTIVE')}
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg"
                            title="Mở khóa tài khoản"
                          >
                            <Unlock className="w-4 h-4" />
                          </button>
                        )
                      )}

                      {hasPermission('users:delete') && !isGuest() && u.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.username)}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                          title="Xóa mềm (Soft delete)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Tạo Tài khoản Người dùng Mới
              </h3>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formErr && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formErr}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã Nhân viên *</label>
                  <input
                    type="text"
                    value={formData.employee_code}
                    onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Họ và Tên *</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Username Đăng nhập *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="nguyenvana"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mật khẩu Khởi tạo *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Công tác *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="a.nguyen@luoidien.evn.vn"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0901234567"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đơn vị *</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đội / Phòng ban</label>
                  <input
                    type="text"
                    value={formData.team}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              {/* Roles Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-2">Gán Nhóm Quyền (Role RBAC):</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(availableRoles.length > 0 ? availableRoles : [
                    { code: 'ADMIN', name: 'ADMIN' },
                    { code: 'CAN_BO_PHUONG_THUC', name: 'CB PHƯƠNG THỨC' },
                    { code: 'TRUONG_CA', name: 'TRƯỞNG CA' },
                    { code: 'PHO_CA', name: 'PHÓ CA' },
                    { code: 'DOI_TRUONG', name: 'ĐỘI TRƯỞNG' },
                    { code: 'FIELD_OPERATOR', name: 'NV HIỆN TRƯỜNG' },
                    { code: 'KHACH', name: 'KHÁCH' }
                  ]).map((r: any) => (
                    <label
                      key={r.code}
                      className={`p-2 border rounded-xl flex items-center space-x-2 cursor-pointer font-semibold text-[11px] ${
                        formData.roles.includes(r.code as RoleCode)
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.roles.includes(r.code as RoleCode)}
                        onChange={() => handleRoleToggle(r.code as RoleCode)}
                        className="rounded text-blue-600"
                      />
                      <span>{r.name || r.code}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Scope Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Phạm vi Tác nghiệp (Scope):</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500">Cấp Scope</span>
                    <select
                      value={formData.scopes[0]?.scope_type || 'SYSTEM'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          scopes: [{ scope_type: e.target.value as ScopeType, scope_value: formData.scopes[0]?.scope_value || 'Toàn hệ thống' }]
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-slate-900"
                    >
                      <option value="SYSTEM">Toàn hệ thống</option>
                      <option value="DON_VI">Đơn vị</option>
                      <option value="DOI">Đội</option>
                      <option value="TRAM">Trạm 110kV</option>
                      <option value="PHAT_TUYEN">Phát tuyến</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500">Giá trị Scope</span>
                    <input
                      type="text"
                      value={formData.scopes[0]?.scope_value || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          scopes: [{ scope_type: formData.scopes[0]?.scope_type || 'SYSTEM', scope_value: e.target.value }]
                        })
                      }
                      placeholder="Ví dụ: Trạm 110kV Nghĩa Đô"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md"
                >
                  {actionLoading ? 'Đang tạo...' : 'Tạo Tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" />
                Sửa Thông tin & Gán Quyền cho [{formData.username}]
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formErr && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formErr}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Họ và Tên</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Công tác</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đơn vị</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đội / Phòng ban</label>
                  <input
                    type="text"
                    value={formData.team}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mật khẩu mới (Bỏ trống nếu không đổi)</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              {/* Roles Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-2">Gán Nhóm Quyền (Role RBAC):</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(availableRoles.length > 0 ? availableRoles : [
                    { code: 'ADMIN', name: 'ADMIN' },
                    { code: 'CAN_BO_PHUONG_THUC', name: 'CB PHƯƠNG THỨC' },
                    { code: 'TRUONG_CA', name: 'TRƯỞNG CA' },
                    { code: 'PHO_CA', name: 'PHÓ CA' },
                    { code: 'DOI_TRUONG', name: 'ĐỘI TRƯỞNG' },
                    { code: 'FIELD_OPERATOR', name: 'NV HIỆN TRƯỜNG' },
                    { code: 'KHACH', name: 'KHÁCH' }
                  ]).map((r: any) => (
                    <label
                      key={r.code}
                      className={`p-2 border rounded-xl flex items-center space-x-2 cursor-pointer font-semibold text-[11px] ${
                        formData.roles.includes(r.code as RoleCode)
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.roles.includes(r.code as RoleCode)}
                        onChange={() => handleRoleToggle(r.code as RoleCode)}
                        className="rounded text-blue-600"
                      />
                      <span>{r.name || r.code}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Scope Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Cập nhật Phạm vi Scope:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500">Cấp Scope</span>
                    <select
                      value={formData.scopes[0]?.scope_type || 'SYSTEM'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          scopes: [{ scope_type: e.target.value as ScopeType, scope_value: formData.scopes[0]?.scope_value || 'Toàn hệ thống' }]
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-slate-900"
                    >
                      <option value="SYSTEM">Toàn hệ thống</option>
                      <option value="DON_VI">Đơn vị</option>
                      <option value="DOI">Đội</option>
                      <option value="TRAM">Trạm 110kV</option>
                      <option value="PHAT_TUYEN">Phát tuyến</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500">Giá trị Scope</span>
                    <input
                      type="text"
                      value={formData.scopes[0]?.scope_value || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          scopes: [{ scope_type: formData.scopes[0]?.scope_type || 'SYSTEM', scope_value: e.target.value }]
                        })
                      }
                      placeholder="Ví dụ: Trạm 110kV Nghĩa Đô"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md"
                >
                  {actionLoading ? 'Đang lưu...' : 'Lưu Thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {approveModalUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Phê duyệt & Kích hoạt Tài khoản [{approveModalUser.username}]
              </h3>
              <button onClick={() => setApproveModalUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 space-y-1">
              <p className="font-bold">{approveModalUser.full_name} ({approveModalUser.email})</p>
              <p className="text-[11px] text-emerald-700">
                Đơn vị đăng ký: <span className="font-semibold">{approveModalUser.unit || 'Chưa rõ'}</span> - {approveModalUser.team || 'Đội chưa đặt'}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Chỉ định Nhóm Quyền (RBAC) <span className="text-red-500">*</span>
                </label>
                <select
                  value={approveRole}
                  onChange={(e) => setApproveRole(e.target.value as RoleCode)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="FIELD_OPERATOR">NHÂN VIÊN HIỆN TRƯỜNG (Thao tác đóng cắt & kiểm tra)</option>
                  <option value="NHAN_VIEN_VAN_HANH">NHÂN VIÊN VẬN HÀNH (Vận hành thiết bị & ghi chép)</option>
                  <option value="DOI_TRUONG">ĐỘI TRƯỞNG (Giám sát đội & duyệt phiếu)</option>
                  <option value="TRUONG_CA">TRƯỞNG CA (Chỉ huy ca vận hành)</option>
                  <option value="PHO_CA">PHÓ CA (Hỗ trợ chỉ huy ca)</option>
                  <option value="CAN_BO_PHUONG_THUC">CÁN BỘ PHƯƠNG THỨC (Cấu hình lưới & phương thức)</option>
                  <option value="ADMIN">QUẢN TRỊ VIÊN HỆ THỐNG (Toàn quyền)</option>
                  <option value="KHACH">KHÁCH (Chỉ xem)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đơn vị Công tác</label>
                  <input
                    type="text"
                    value={approveUnit}
                    onChange={(e) => setApproveUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đội / Tổ / Nhóm</label>
                  <input
                    type="text"
                    value={approveTeam}
                    onChange={(e) => setApproveTeam(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Chức danh Vận hành</label>
                <input
                  type="text"
                  value={approveTitle}
                  onChange={(e) => setApproveTitle(e.target.value)}
                  placeholder="Ví dụ: Kỹ sư vận hành lưới điện"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setApproveModalUser(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmApprove}
                className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/30 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{actionLoading ? 'Đang duyệt...' : 'Xác nhận Phê duyệt & Kích hoạt'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                Từ chối Tài khoản [{rejectModalUser.username}]
              </h3>
              <button onClick={() => setRejectModalUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-600">
              Nhập lý do từ chối để thông báo và lưu vết vào hệ thống Audit Log:
            </p>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Lý do từ chối <span className="text-red-500">*</span></label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập lý do từ chối..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setRejectModalUser(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmReject}
                className="px-5 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/30 flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>{actionLoading ? 'Đang xử lý...' : 'Xác nhận Từ chối'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail View Modal */}
      {detailModalUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                Hồ sơ Chi tiết Người dùng
              </h3>
              <button onClick={() => setDetailModalUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center">
                  {detailModalUser.full_name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{detailModalUser.full_name}</h4>
                  <p className="text-slate-500">Mã NV: {detailModalUser.employee_code} | User: {detailModalUser.username}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <p><strong>Email:</strong> {detailModalUser.email}</p>
                <p><strong>Điện thoại:</strong> {detailModalUser.phone || 'Chưa cập nhật'}</p>
                <p><strong>Đơn vị:</strong> {detailModalUser.unit}</p>
                <p><strong>Đội:</strong> {detailModalUser.team}</p>
                <p><strong>Chức danh:</strong> {detailModalUser.title}</p>
                <p><strong>Trạng thái:</strong> {detailModalUser.status}</p>
              </div>

              {/* Approval/Rejection Audit Details */}
              {detailModalUser.approved_by && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-[11px] space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Đã phê duyệt bởi: <span className="font-mono">{detailModalUser.approved_by}</span>
                  </p>
                  <p className="text-slate-600">Thời gian: {detailModalUser.approved_at ? formatDateTime(detailModalUser.approved_at) : 'N/A'}</p>
                </div>
              )}

              {detailModalUser.status === 'REJECTED' && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 text-[11px] space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    Đã từ chối bởi: <span className="font-mono">{detailModalUser.rejected_by || 'Admin'}</span>
                  </p>
                  <p className="text-slate-600">Thời gian: {detailModalUser.rejected_at ? formatDateTime(detailModalUser.rejected_at) : 'N/A'}</p>
                  <p className="text-rose-800 font-semibold">Lý do: {detailModalUser.rejection_reason || 'Không có lý do cụ thể'}</p>
                </div>
              )}

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <p className="font-bold text-blue-900 mb-1">Nhóm Quyền RBAC:</p>
                <div className="flex flex-wrap gap-1">
                  {detailModalUser.roles?.map(r => (
                    <span key={r} className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded">
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900 mb-1">Phạm vi Scope Tác nghiệp:</p>
                {detailModalUser.scopes?.map((s, idx) => (
                  <p key={idx} className="text-slate-700 font-medium">
                    • Cấp {s.scope_type}: <span className="text-blue-700">{s.scope_value}</span>
                  </p>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setDetailModalUser(null)}
                className="px-4 py-2 font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
