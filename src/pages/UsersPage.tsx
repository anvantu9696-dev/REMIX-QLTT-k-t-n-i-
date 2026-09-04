import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Users,
  Search,
  Lock,
  Unlock,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, limit } from 'firebase/firestore';
import { User, RoleCode, UserStatus } from '../types';
import { formatDateTime } from '../utils/dateTime';
import { api } from '../lib/api';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(query(collection(db, 'users'), where('deleted_at', '==', null), limit(100)));
      const list: User[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id as any,
          employee_code: data.employee_code || `USER-${docSnap.id.slice(0, 5)}`,
          full_name: data.displayName || data.full_name || data.email?.split('@')[0] || 'User',
          username: data.username || data.email?.split('@')[0] || '',
          email: data.email || '',
          phone: data.phone || '',
          unit: data.unit || 'EVN',
          team: data.team || 'Đội Vận hành',
          title: data.title || 'Chuyên viên',
          status: data.status || 'PENDING',
          roles: data.roles || [data.role || 'VIEWER'],
          isActive: data.isActive ?? true,
          created_at: data.createdAt || new Date().toISOString(),
          updated_at: data.updatedAt || new Date().toISOString(),
          lastLoginAt: data.lastLoginAt
        } as any);
      });
      
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setUsers(list);
    } catch (err) {
      console.error("Lỗi khi tải danh sách users", err);
      toast.error('Lỗi khi tải danh sách users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateStatus = async (uid: string, newStatus: UserStatus) => {
    try {
      const targetUser = users.find(u => String(u.id) === uid);
      if (newStatus === 'LOCKED' || newStatus === 'DISABLED') {
        const activeAdmins = users.filter(u => (u.roles?.includes('ADMIN') || (u as any).role === 'ADMIN') && u.status === 'ACTIVE');
        const isTargetAdmin = targetUser?.roles?.includes('ADMIN') || (targetUser as any)?.role === 'ADMIN';
        if (isTargetAdmin && activeAdmins.length <= 1) {
          toast.error('Không thể khóa Quản trị viên (Admin) duy nhất cuối cùng của hệ thống!');
          return;
        }
      }

      if (targetUser?.email) {
        await api.syncUserStatus(targetUser.email, newStatus, uid);
        
        toast.success(`Đã cập nhật trạng thái thành ${newStatus}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Thao tác thất bại');
    }
  };

  const handleRoleChange = async (uid: string, newRole: RoleCode) => {
    try {
      const activeAdmins = users.filter(u => (u.roles?.includes('ADMIN') || (u as any).role === 'ADMIN') && u.status === 'ACTIVE');
      const targetUser = users.find(u => String(u.id) === uid);
      const isTargetAdmin = targetUser?.roles?.includes('ADMIN') || (targetUser as any)?.role === 'ADMIN';
      
      if (isTargetAdmin && newRole !== 'ADMIN' && activeAdmins.length <= 1) {
        toast.error('Không thể hạ quyền Quản trị viên (Admin) duy nhất cuối cùng của hệ thống!');
        return;
      }

      if (targetUser) {
        await api.changeUserRole(targetUser.id, newRole, targetUser.email);
        toast.success(`Đã đổi vai trò thành ${newRole}`);
      }
    } catch (err: any) {
      console.error('Lỗi khi đổi vai trò:', err);
      toast.error(err.message || 'Đổi vai trò thất bại');
    }
  };

  const handleApprove = async (uid: string) => {
    try {
      const targetUser = users.find(u => String(u.id) === uid);
      if (targetUser?.email) {
        await api.syncUserStatus(targetUser.email, 'ACTIVE', uid);
        
        toast.success('Đã phê duyệt tài khoản thành công (Trạng thái: ACTIVE)');
      }
    } catch (err: any) {
      toast.error(err.message || 'Phê duyệt thất bại');
    }
  };

  const handleReject = async (uid: string) => {
    const reason = prompt('Nhập lý do từ chối:', 'Thông tin đăng ký chưa hợp lệ.');
    if (reason === null) return;
    try {
      const targetUser = users.find(u => String(u.id) === uid);
      if (targetUser?.email) {
        await api.syncUserStatus(targetUser.email, 'REJECTED', uid);
        
        toast.success('Đã từ chối tài khoản');
      }
    } catch (err: any) {
      toast.error(err.message || 'Thao tác thất bại');
    }
  };

  const handleDelete = async (uid: string, name: string) => {
    const activeAdmins = users.filter(u => (u.roles?.includes('ADMIN') || (u as any).role === 'ADMIN') && u.status === 'ACTIVE');
    const targetUser = users.find(u => String(u.id) === uid);
    const isTargetAdmin = targetUser?.roles?.includes('ADMIN') || (targetUser as any)?.role === 'ADMIN';

    if (isTargetAdmin && activeAdmins.length <= 1) {
      toast.error('Không thể xóa Quản trị viên (Admin) duy nhất cuối cùng!');
      return;
    }

    if (!window.confirm(`Xác nhận xóa tài khoản [${name}] khỏi hệ thống?`)) return;

    try {
      if (targetUser?.email) {
        await api.syncDeleteUser(targetUser.email, uid);
        
        toast.success('Đã xóa tài khoản thành công');
      }
    } catch (err: any) {
      toast.error(err.message || 'Xóa thất bại');
    }
  };

  // Filter users
  const filteredUsers = users.filter(u => {
    const matchesSearch = !search || 
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = !statusFilter || u.status === statusFilter;
    const matchesRole = !roleFilter || u.roles?.includes(roleFilter as RoleCode) || (u as any).role === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Quản lý Người dùng hệ thống</h1>
              <p className="text-xs text-slate-500 mt-0.5">Quản lý hồ sơ người dùng Google thực tế, phân quyền 4 nhóm (ADMIN, MANAGER, STAFF, VIEWER) và phê duyệt tài khoản.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Tổng số: {users.length} tài khoản
          </span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên, email, username..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING">Chờ duyệt (Pending)</option>
            <option value="ACTIVE">Đang hoạt động (Active)</option>
            <option value="LOCKED">Đã khóa (Locked)</option>
            <option value="REJECTED">Đã từ chối (Rejected)</option>
          </select>

          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="">Tất cả vai trò</option>
            <option value="ADMIN">ADMIN</option>
            <option value="MANAGER">MANAGER</option>
            <option value="SHIFT_LEADER">Trưởng ca vận hành</option>
            <option value="STAFF">STAFF</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs font-medium">Đang tải danh sách người dùng realtime từ Firestore...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs font-medium">Không tìm thấy tài khoản người dùng nào khớp với bộ lọc.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Họ tên & Email</th>
                  <th className="py-3.5 px-4">Vai trò (Role)</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Đăng nhập gần nhất</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredUsers.map(u => {
                  const uid = String(u.id);
                  const currentRole = u.roles?.[0] || (u as any).role || 'VIEWER';
                  return (
                    <tr key={uid} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                            {u.full_name?.slice(0, 2).toUpperCase() || 'US'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{u.full_name}</p>
                            <p className="text-[11px] text-slate-500">{u.email}</p>
                            <p className="text-[10px] font-mono text-slate-400">UID: {uid}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={currentRole}
                          onChange={e => handleRoleChange(uid, e.target.value as RoleCode)}
                          className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="SHIFT_LEADER">Trưởng ca vận hành</option>
                          <option value="STAFF">STAFF</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4">
                        {u.status === 'ACTIVE' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ACTIVE
                          </span>
                        )}
                        {u.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-300 animate-pulse">
                            <AlertCircle className="w-3 h-3 text-amber-600" /> PENDING
                          </span>
                        )}
                        {u.status === 'LOCKED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <Lock className="w-3 h-3 text-rose-600" /> LOCKED
                          </span>
                        )}
                        {u.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                            <XCircle className="w-3 h-3 text-slate-500" /> REJECTED
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Chưa ghi nhận'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {u.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApprove(uid)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] shadow-sm transition-all"
                                title="Duyệt tài khoản"
                              >
                                Duyệt
                              </button>
                              <button
                                onClick={() => handleReject(uid)}
                                className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold rounded-lg text-[11px] transition-all"
                                title="Từ chối tài khoản"
                              >
                                Từ chối
                              </button>
                            </>
                          )}

                          {u.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleUpdateStatus(uid, 'LOCKED')}
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 transition-all"
                              title="Khóa tài khoản"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                          ) : u.status === 'LOCKED' ? (
                            <button
                              onClick={() => handleUpdateStatus(uid, 'ACTIVE')}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition-all"
                              title="Mở khóa tài khoản"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          ) : null}

                          <button
                            onClick={() => handleDelete(uid, u.full_name)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-all"
                            title="Xóa tài khoản"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
