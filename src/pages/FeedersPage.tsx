import React, { useState, useEffect } from 'react';
import {
  GitCommitHorizontal,
  Plus,
  Search,
  Building2,
  Edit2,
  Trash2,
  Zap,
  AlertCircle,
  X,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { api } from '../lib/api';
import { Feeder, Substation } from '../types';
import { useAuth } from '../context/AuthContext';
import { useRealtimeSync } from '../lib/realtime';

interface UsageDetails {
  active_devices?: any[];
  active_loops?: any[];
  active_tasks?: any[];
  active_issues?: any[];
  active_schedules?: any[];
}

interface FeedersPageProps {
  onNavigateToDevices?: (feederId: number | string) => void;
  onNavigateToLoops?: () => void;
  selectedSubstationId?: number | string;
}

export const FeedersPage: React.FC<FeedersPageProps> = ({
  onNavigateToDevices,
  onNavigateToLoops,
  selectedSubstationId
}) => {
  const { isGuest, hasRole } = useAuth();
  const [feeders, setFeeders] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [substationFilter, setSubstationFilter] = useState<string>(selectedSubstationId ? String(selectedSubstationId) : '');
  
  // Sync prop changes (e.g. from browser back/forward navigation)
  useEffect(() => {
    if (selectedSubstationId !== undefined) {
      setSubstationFilter(String(selectedSubstationId));
    } else {
      setSubstationFilter('');
    }
  }, [selectedSubstationId]);

  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFeeder, setEditingFeeder] = useState<Feeder | null>(null);
  const [formData, setFormData] = useState({
    feeder_code: '',
    name: '',
    substation_id: '',
    start_point: '',
    end_point: '',
    notes: '',
    status: 'ACTIVE'
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation Modal State
  const [deleteConfirmFeeder, setDeleteConfirmFeeder] = useState<Feeder | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Dependency Blocked Modal State
  const [blockedModalData, setBlockedModalData] = useState<{
    feeder: Feeder;
    message: string;
    usage: UsageDetails;
  } | null>(null);

  useEffect(() => {
    fetchSubstationsList();
  }, []);

  useEffect(() => {
    fetchFeeders();
  }, [search, substationFilter, statusFilter]);

  useRealtimeSync(() => {
    fetchFeeders();
    fetchSubstationsList();
  });

  const fetchSubstationsList = async () => {
    try {
      const res = await api.getSubstations();
      if (res.success) {
        setSubstations(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFeeders = async () => {
    setLoading(true);
    try {
      const res = await api.getFeeders({
        search,
        substation_id: substationFilter,
        status: statusFilter,
        limit: 10
      });
      if (res.success) {
        setFeeders(res.data);
        setNextCursor(res.nextCursor || null);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách Phát tuyến');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await api.getFeeders({
        search,
        substation_id: substationFilter,
        status: statusFilter,
        limit: 10,
        lastDocId: nextCursor
      });
      if (res.success) {
        setFeeders(prev => {
          const existing = new Set(prev.map(f => f.id));
          const newItems = res.data.filter(f => !existing.has(f.id));
          return [...prev, ...newItems];
        });
        setNextCursor(res.nextCursor || null);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải thêm danh sách Phát tuyến');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOpenAddModal = () => {
    if (isGuest()) return;
    setEditingFeeder(null);
    setFormData({
      feeder_code: '',
      name: '',
      substation_id: substations[0] ? String(substations[0].id) : '',
      start_point: '',
      end_point: '',
      notes: '',
      status: 'ACTIVE'
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (feeder: Feeder) => {
    if (isGuest()) return;
    setEditingFeeder(feeder);
    setFormData({
      feeder_code: feeder.feeder_code,
      name: feeder.name,
      substation_id: String(feeder.substation_id),
      start_point: feeder.start_point || '',
      end_point: feeder.end_point || '',
      notes: feeder.notes || '',
      status: feeder.status || 'ACTIVE'
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.feeder_code.trim() || !formData.name.trim() || !formData.substation_id) {
      setFormError('Mã phát tuyến, Tên phát tuyến và Trạm 110kV là bắt buộc.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingFeeder) {
        await api.updateFeeder(editingFeeder.id, formData);
        setSuccess(`Cập nhật thành công phát tuyến ${formData.name}`);
      } else {
        await api.createFeeder(formData);
        setSuccess(`Thêm mới phát tuyến ${formData.name}`);
      }
      setModalOpen(false);
      fetchFeeders();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu phát tuyến');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDeleteConfirm = (feeder: Feeder) => {
    if (isGuest()) return;
    if (!hasRole('ADMIN')) {
      setError('Bạn không có quyền thực hiện thao tác xóa phát tuyến.');
      return;
    }
    setDeleteConfirmFeeder(feeder);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmFeeder) return;
    setDeleting(true);
    setError('');

    try {
      const targetFeeder = deleteConfirmFeeder;
      const res = await api.deleteFeeder(targetFeeder.id);
      setSuccess(res.message || `Đã xóa thành công phát tuyến "${targetFeeder.name}"`);
      setDeleteConfirmFeeder(null);
      fetchFeeders();
    } catch (err: any) {
      const targetFeeder = deleteConfirmFeeder;
      setDeleteConfirmFeeder(null);

      if (err.status === 409 || err.usage || err.data?.usage) {
        setBlockedModalData({
          feeder: targetFeeder,
          message: err.message || 'Không thể xóa phát tuyến vì đang có dữ liệu liên quan.',
          usage: err.usage || err.data?.usage || {}
        });
      } else if (err.status === 403) {
        setError('Bạn không có quyền xóa phát tuyến này.');
      } else if (err.status === 404) {
        setError('Phát tuyến không tồn tại hoặc đã bị xóa trước đó.');
      } else {
        setError(err.message || 'Không thể xóa phát tuyến');
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleForceDelete = async () => {
    if (!blockedModalData) return;
    const targetFeeder = blockedModalData.feeder;
    if (!window.confirm(`Xác nhận cưỡng chế xóa phát tuyến "${targetFeeder.name}" (${targetFeeder.feeder_code})? Các thiết bị và liên kết khép vòng trên tuyến sẽ được tự động gỡ bỏ.`)) {
      return;
    }
    setDeleting(true);
    setBlockedModalData(null);
    setError('');
    try {
      const res = await api.deleteFeeder(targetFeeder.id, crypto.randomUUID(), true);
      setSuccess(res.message || `Đã cưỡng chế xóa thành công phát tuyến "${targetFeeder.name}"`);
      fetchFeeders();
    } catch (err: any) {
      setError(err.message || 'Không thể cưỡng chế xóa phát tuyến');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <GitCommitHorizontal className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Danh mục Phát tuyến Đường dây</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi tuyến đường dây trung thế 22kV / 35kV, điểm đầu, điểm cuối và các thiết bị liên kết.
          </p>
        </div>

        {!isGuest() && (hasRole('ADMIN') || hasRole('MANAGER')) && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Thêm Phát tuyến
          </button>
        )}
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-800 text-xs">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-600 font-bold">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-red-800 text-xs">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-600 font-bold">✕</button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo Mã phát tuyến, Tên phát tuyến, Điểm đầu/cuối..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={substationFilter}
          onChange={e => setSubstationFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
        >
          <option value="">Tất cả Trạm 110kV</option>
          {substations.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.substation_code})</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
          <option value="INACTIVE">Tạm khóa (INACTIVE)</option>
        </select>
      </div>

      {/* Feeders Table View */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center text-slate-500 text-xs font-medium">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mr-2" />
            Đang tải dữ liệu Phát tuyến...
          </div>
        ) : feeders.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <GitCommitHorizontal className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-semibold">Không tìm thấy phát tuyến nào phù hợp</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-300 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3 px-4">Mã Phát Tuyến</th>
                  <th className="py-3 px-4">Tên Phát Tuyến</th>
                  <th className="py-3 px-4">Trạm 110kV Phụ Trách</th>
                  <th className="py-3 px-4">Phạm Vi (Đầu → Cuối)</th>
                  <th className="py-3 px-4 text-center">Số Thiết Bị</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {feeders.map(feeder => (
                  <tr key={feeder.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                      {feeder.feeder_code}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {feeder.name}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{feeder.substation_name || 'N/A'}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-[11px] text-slate-600">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-slate-800">{feeder.start_point || 'Đầu tuyến'}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-800">{feeder.end_point || 'Cuối tuyến'}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800">
                        <Zap className="w-3 h-3 mr-1 text-amber-500" />
                        {feeder.device_count || 0}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        feeder.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {feeder.status === 'ACTIVE' ? 'Đang VH' : 'Tạm dừng'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onNavigateToDevices && (
                          <button
                            onClick={() => onNavigateToDevices(feeder.id)}
                            className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded hover:bg-blue-100 transition-colors"
                          >
                            Thiết bị
                          </button>
                        )}

                        {!isGuest() && (
                          <>
                            {(hasRole('ADMIN') || hasRole('MANAGER')) && (
                              <button
                                onClick={() => handleOpenEditModal(feeder)}
                                className="p-1.5 text-slate-600 hover:text-blue-600 rounded hover:bg-slate-100 transition-colors"
                                title="Sửa phát tuyến"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {hasRole('ADMIN') && (
                              <button
                                onClick={() => handleOpenDeleteConfirm(feeder)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 transition-colors"
                                title="Xóa mềm phát tuyến"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add/Edit Feeder */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <GitCommitHorizontal className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingFeeder ? `Chỉnh sửa Phát tuyến: ${editingFeeder.name}` : 'Thêm mới Phát tuyến Đường dây'}
                </h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã Phát tuyến *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: F471-E1.1"
                    value={formData.feeder_code}
                    onChange={e => setFormData({ ...formData, feeder_code: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Trạng thái</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold focus:outline-none focus:border-blue-500"
                  >
                    <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
                    <option value="INACTIVE">Tạm dừng (INACTIVE)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Trạm 110kV Quản lý *</label>
                <select
                  required
                  value={formData.substation_id}
                  onChange={e => setFormData({ ...formData, substation_id: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Chọn Trạm 110kV --</option>
                  {substations.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.substation_code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên Phát tuyến *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Phát tuyến 471 E1.1 Nghĩa Đô"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Điểm đầu tuyến</label>
                  <input
                    type="text"
                    placeholder="VD: Thanh cái 22kV E1.1"
                    value={formData.start_point}
                    onChange={e => setFormData({ ...formData, start_point: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Điểm cuối tuyến</label>
                  <input
                    type="text"
                    placeholder="VD: Cầu dao 471-7 Hoàng Quốc Việt"
                    value={formData.end_point}
                    onChange={e => setFormData({ ...formData, end_point: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ghi chú</label>
                <textarea
                  rows={3}
                  placeholder="Mô tả phụ tải, tiết diện đường dây..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : editingFeeder ? 'Lưu thay đổi' : 'Tạo Phát tuyến'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmFeeder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-5 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Xác nhận xóa Phát tuyến</h3>
                  <p className="text-[11px] text-red-600 font-medium">Hành động này cần xác nhận thận trọng</p>
                </div>
              </div>
              <button
                onClick={() => setDeleteConfirmFeeder(null)}
                disabled={deleting}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="font-semibold text-slate-800 text-sm">
                Bạn có chắc chắn muốn xóa phát tuyến này?
              </p>

              {/* Feeder Info Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Mã phát tuyến:</span>
                  <span className="font-mono font-bold text-blue-600">{deleteConfirmFeeder.feeder_code}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Tên phát tuyến:</span>
                  <span className="font-bold text-slate-900">{deleteConfirmFeeder.name}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Trạm 110kV phụ trách:</span>
                  <span className="font-semibold text-slate-800">{deleteConfirmFeeder.substation_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Số thiết bị liên kết:</span>
                  <span className="font-bold text-amber-600 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" />
                    {deleteConfirmFeeder.device_count || 0} thiết bị
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Trạng thái:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    deleteConfirmFeeder.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {deleteConfirmFeeder.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm dừng'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[11px] leading-relaxed flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Lưu ý Soft Delete:</strong> Hệ thống thực hiện xóa mềm. Dữ liệu lịch sử vận hành vẫn được giữ nguyên trong cơ sở dữ liệu.
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmFeeder(null)}
                disabled={deleting}
                className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-5 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Xóa Phát tuyến</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dependency Blocked Modal */}
      {blockedModalData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-5 bg-red-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-700 rounded-xl">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Không thể xóa Phát tuyến</h3>
                  <p className="text-xs text-red-100 font-medium">
                    Phát tuyến "{blockedModalData.feeder.name}" ({blockedModalData.feeder.feeder_code}) đang có dữ liệu liên kết
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBlockedModalData(null)}
                className="text-red-200 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Primary Warning Message */}
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 font-semibold flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p>{blockedModalData.message}</p>
                  <p className="text-[11px] font-normal text-red-700">
                    Để đảm bảo tính toàn vẹn dữ liệu lưới điện, bạn không thể xóa phát tuyến này cho đến khi gỡ bỏ hoặc xử lý hết các liên kết bên dưới.
                  </p>
                </div>
              </div>

              {/* 1. Linked Devices Section */}
              {blockedModalData.usage.active_devices && blockedModalData.usage.active_devices.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <h4 className="font-bold text-slate-900 text-xs">
                        Thiết bị liên kết ({blockedModalData.usage.active_devices.length})
                      </h4>
                    </div>
                    {onNavigateToDevices && (
                      <button
                        onClick={() => {
                          const fid = blockedModalData.feeder.id;
                          setBlockedModalData(null);
                          onNavigateToDevices(fid);
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded-lg font-bold text-[11px] hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        <span>Quản lý Thiết bị</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 font-bold text-slate-700 uppercase text-[10px]">
                        <tr>
                          <th className="p-2">Mã Thiết Bị</th>
                          <th className="p-2">Tên Thiết Bị</th>
                          <th className="p-2">Loại</th>
                          <th className="p-2">Vị trí trụ lắp đặt</th>
                          <th className="p-2 text-right">Trạng Thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {blockedModalData.usage.active_devices.map((dev: any) => (
                          <tr key={dev.id} className="hover:bg-slate-50">
                            <td className="p-2 font-mono font-bold text-blue-600">{dev.device_code}</td>
                            <td className="p-2 font-semibold text-slate-900">{dev.name}</td>
                            <td className="p-2 text-slate-600">{dev.device_type}</td>
                            <td className="p-2 text-slate-500">{dev.pole_number || 'N/A'}</td>
                            <td className="p-2 text-right font-bold text-emerald-600">{dev.status || 'ACTIVE'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 2. Linked Loops Section */}
              {blockedModalData.usage.active_loops && blockedModalData.usage.active_loops.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <GitCommitHorizontal className="w-4 h-4 text-purple-600" />
                      <h4 className="font-bold text-slate-900 text-xs">
                        Khép vòng liên kết ({blockedModalData.usage.active_loops.length})
                      </h4>
                    </div>
                    {onNavigateToLoops && (
                      <button
                        onClick={() => {
                          setBlockedModalData(null);
                          onNavigateToLoops();
                        }}
                        className="px-3 py-1 bg-purple-600 text-white rounded-lg font-bold text-[11px] hover:bg-purple-700 transition-colors flex items-center gap-1"
                      >
                        <span>XEM KHÉP VÒNG</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 font-bold text-slate-700 uppercase text-[10px]">
                        <tr>
                          <th className="p-2">Mã Khép Vòng</th>
                          <th className="p-2">Tên Khép Vòng</th>
                          <th className="p-2 text-right">Trạng Thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {blockedModalData.usage.active_loops.map((loop: any) => (
                          <tr key={loop.id} className="hover:bg-slate-50">
                            <td className="p-2 font-mono font-bold text-purple-600">{loop.loop_id}</td>
                            <td className="p-2 font-semibold text-slate-900">{loop.name}</td>
                            <td className="p-2 text-right font-bold text-emerald-600">{loop.status || 'ACTIVE'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3. Linked Tasks / Issues / Schedules if any */}
              {((blockedModalData.usage.active_tasks && blockedModalData.usage.active_tasks.length > 0) ||
                (blockedModalData.usage.active_issues && blockedModalData.usage.active_issues.length > 0) ||
                (blockedModalData.usage.active_schedules && blockedModalData.usage.active_schedules.length > 0)) && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs">Dữ liệu vận hành khác đang liên kết:</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    {blockedModalData.usage.active_tasks && blockedModalData.usage.active_tasks.length > 0 && (
                      <li>{blockedModalData.usage.active_tasks.length} công việc chưa hoàn thành trên tuyến</li>
                    )}
                    {blockedModalData.usage.active_issues && blockedModalData.usage.active_issues.length > 0 && (
                      <li>{blockedModalData.usage.active_issues.length} phiếu khiếu nại / bất thường chưa xử lý</li>
                    )}
                    {blockedModalData.usage.active_schedules && blockedModalData.usage.active_schedules.length > 0 && (
                      <li>{blockedModalData.usage.active_schedules.length} lịch kiểm tra định kỳ đang active</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={handleForceDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-xs hover:bg-red-700 transition-colors flex items-center gap-1.5"
              >
                <span>Cưỡng chế Xóa (Gỡ liên kết & Xóa)</span>
              </button>
              <button
                type="button"
                onClick={() => setBlockedModalData(null)}
                className="px-5 py-2 bg-slate-800 text-white rounded-lg font-bold text-xs hover:bg-slate-900 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      {nextCursor && (
        <div className="mt-6 flex justify-center pb-6">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center transition-colors shadow-sm font-medium"
          >
            {loadingMore ? 'Đang tải...' : 'Tải thêm phát tuyến'}
          </button>
        </div>
      )}
    </div>
  );
};
