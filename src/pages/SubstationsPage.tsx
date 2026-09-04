import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  MapPin,
  ExternalLink,
  Edit2,
  Trash2,
  GitCommitHorizontal,
  Zap,
  AlertCircle,
  X,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { api } from '../lib/api';
import { Substation } from '../types';
import { useAuth } from '../context/AuthContext';
import { useDataContext } from '../context/DataContext';
import { useRealtimeSync } from '../lib/realtime';

interface SubstationsPageProps {
  onNavigateToFeeders?: (stationId: number | string) => void;
}

export const SubstationsPage: React.FC<SubstationsPageProps> = ({ onNavigateToFeeders }) => {
  const { isGuest, hasRole } = useAuth();
  const {
    substations,
    loadingSubstations,
    fetchSubstations,
    addSubstationInCache,
    updateSubstationInCache,
    deleteSubstationFromCache
  } = useDataContext();

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Substation | null>(null);
  const [formData, setFormData] = useState({
    substation_code: '',
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    google_maps_url: '',
    image_url: '',
    notes: '',
    status: 'ACTIVE'
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingStation, setDeletingStation] = useState<Substation | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteUsage, setDeleteUsage] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Detail Modal State
  const [detailStation, setDetailStation] = useState<Substation | null>(null);

  useEffect(() => {
    fetchSubstations();
  }, [fetchSubstations]);

  useRealtimeSync(() => {
    fetchSubstations(true);
  });

  const filteredSubstations = useMemo(() => {
    return substations.filter(station => {
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        const matchCode = station.substation_code?.toLowerCase().includes(q);
        const matchName = station.name?.toLowerCase().includes(q);
        const matchAddress = station.address?.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchAddress) return false;
      }
      if (statusFilter && station.status !== statusFilter) return false;
      return true;
    });
  }, [substations, search, statusFilter]);

  const handleOpenAddModal = () => {
    if (isGuest()) return;
    setEditingStation(null);
    setFormData({
      substation_code: '',
      name: '',
      address: '',
      latitude: '',
      longitude: '',
      google_maps_url: '',
      image_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
      notes: '',
      status: 'ACTIVE'
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (station: Substation) => {
    if (isGuest()) return;
    setEditingStation(station);
    setFormData({
      substation_code: station.substation_code,
      name: station.name,
      address: station.address || '',
      latitude: station.latitude ? String(station.latitude) : '',
      longitude: station.longitude ? String(station.longitude) : '',
      google_maps_url: station.google_maps_url || '',
      image_url: station.image_url || '',
      notes: station.notes || '',
      status: station.status || 'ACTIVE'
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.substation_code.trim() || !formData.name.trim()) {
      setFormError('Mã trạm và Tên trạm không được để trống.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingStation) {
        const res = await api.updateSubstation(editingStation.id, formData, undefined, editingStation.version);
        setSuccess(`Cập nhật thành công Trạm ${formData.name}`);
        const updated = res.data ? res.data : { ...editingStation, ...formData };
        updateSubstationInCache(editingStation.id, updated);
      } else {
        const res = await api.createSubstation(formData);
        setSuccess(`Thêm mới thành công Trạm ${formData.name}`);
        if (res.data) {
          addSubstationInCache(res.data);
        } else {
          addSubstationInCache({ id: Date.now(), ...formData } as any);
        }
      }
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu thông tin Trạm 110kV');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (station: Substation) => {
    if (isGuest()) return;
    setDeletingStation(station);
    setDeleteError('');
    setDeleteUsage(null);
    setIsDeleting(false);
    setDeleteModalOpen(true);
  };

  const handleConfirmDeleteSubstation = async () => {
    if (!deletingStation || isGuest()) return;
    setIsDeleting(true);
    setDeleteError('');
    setDeleteUsage(null);

    try {
      const res: any = await api.deleteSubstation(deletingStation.id);
      setSuccess(res.message || `Đã xóa mềm Trạm 110kV ${deletingStation.name}`);
      setDeleteModalOpen(false);
      deleteSubstationFromCache(deletingStation.id);
      setDeletingStation(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Không thể xóa Trạm 110kV');
      if (err.usage) {
        setDeleteUsage(err.usage);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGrabGps = () => {
    if (!navigator.geolocation) {
      setFormError('Trình duyệt không hỗ trợ Geolocation GPS.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          google_maps_url: `https://maps.google.com/?q=${lat},${lng}`
        }));
      },
      (err) => {
        setFormError(`Không thể lấy vị trí GPS: ${err.message}`);
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Danh mục Trạm Biến áp 110kV</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý vị trí địa lý, quy mô máy biến áp và danh sách phát tuyến kết nối thuộc Trạm 110kV.
          </p>
        </div>

        {!isGuest() && (hasRole('ADMIN') || (hasRole('MANAGER') || hasRole('SHIFT_LEADER'))) && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Thêm Trạm 110kV
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
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-600 font-bold">✕</button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo Mã trạm, Tên trạm, Địa chỉ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang vận hành</option>
          <option value="MAINTENANCE">Đang bảo dưỡng</option>
          <option value="INACTIVE">Tạm ngừng</option>
        </select>

        <button
          onClick={() => { setSearch(''); setStatusFilter(''); }}
          className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200"
        >
          Xóa bộ lọc
        </button>
      </div>

      {/* Substations Cards Grid */}
      {loadingSubstations ? (
        <div className="py-12 flex justify-center text-slate-500 text-xs font-medium">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mr-2" />
          Đang tải dữ liệu Trạm 110kV...
        </div>
      ) : filteredSubstations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          <Building2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-semibold">Không tìm thấy trạm 110kV nào phù hợp</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
          {filteredSubstations.map(station => (
            <div
              key={station.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Station Cover Image Header */}
                <div className="relative h-40 bg-slate-800 overflow-hidden">
                  <img
                    src={station.image_url || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'}
                    alt={station.name}
                    className="w-full h-full object-cover opacity-90 hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-slate-700">
                    {station.substation_code}
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                      station.status === 'ACTIVE' ? 'bg-emerald-500 text-white shadow' :
                      station.status === 'MAINTENANCE' ? 'bg-amber-500 text-white shadow' :
                      'bg-slate-600 text-white'
                    }`}>
                      {station.status === 'ACTIVE' ? 'Đang VH' : station.status === 'MAINTENANCE' ? 'Bảo dưỡng' : 'Tạm dừng'}
                    </span>
                  </div>
                </div>

                {/* Info Container */}
                <div className="p-5 space-y-3">
                  <h3 className="text-base font-bold text-slate-900 leading-snug">{station.name}</h3>

                  <div className="flex items-start gap-2 text-xs text-slate-600">
                    <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{station.address || 'Chưa cập nhật địa chỉ'}</span>
                  </div>

                  {/* GPS & Maps link */}
                  {(station.latitude || station.google_maps_url) && (
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono pt-1">
                      {station.latitude && station.longitude && (
                        <span>GPS: {station.latitude}, {station.longitude}</span>
                      )}
                      {station.google_maps_url && (
                        <a
                          href={station.google_maps_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 font-semibold hover:underline"
                        >
                          Google Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}

                  {station.notes && (
                    <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-100 italic line-clamp-2">
                      "{station.notes}"
                    </p>
                  )}

                  {/* Operational Stats Row */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <div className="bg-blue-50/60 p-2 rounded text-center border border-blue-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">Phát tuyến</span>
                      <span className="text-base font-extrabold text-blue-900">{station.feeder_count || 0}</span>
                    </div>

                    <div className="bg-slate-50 p-2 rounded text-center border border-slate-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">Thiết bị</span>
                      <span className="text-base font-extrabold text-slate-800">{station.device_count || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDetailStation(station)}
                    className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded text-[11px] font-bold hover:bg-slate-200 inline-flex items-center gap-1 shadow-sm"
                    title="Xem chi tiết"
                  >
                    🔍 Chi tiết
                  </button>
                  {onNavigateToFeeders ? (
                    <button
                      onClick={() => onNavigateToFeeders(station.id)}
                      className="text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1"
                    >
                      <GitCommitHorizontal className="w-3.5 h-3.5" />
                      Xem các phát tuyến
                    </button>
                  ) : (
                    <span className="text-slate-400 text-[11px]">Trạm 110kV</span>
                  )}

                  <button
                    onClick={() => {
                      if (station.latitude != null && station.longitude != null && !isNaN(Number(station.latitude)) && !isNaN(Number(station.longitude))) {
                        const lat = Number(station.latitude);
                        const lng = Number(station.longitude);
                        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                          window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                          return;
                        }
                      }
                      if (station.google_maps_url && typeof station.google_maps_url === 'string' && station.google_maps_url.trim().length > 0) {
                        const gUrl = station.google_maps_url.trim();
                        if (gUrl.startsWith('http://') || gUrl.startsWith('https://')) {
                          window.open(gUrl, '_blank');
                          return;
                        } else {
                          alert('Liên kết Google Maps của trạm không hợp lệ.');
                          return;
                        }
                      }
                      alert('Trạm chưa được cập nhật vị trí.');
                    }}
                    className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold hover:bg-emerald-700 inline-flex items-center gap-1 shadow-sm"
                    title="Chỉ đường đến trạm 110kV"
                  >
                    🧭 Chỉ đường
                  </button>
                </div>

                {!isGuest() && (
                  <div className="flex items-center gap-2">
                    {((hasRole('ADMIN') || (hasRole('MANAGER') || hasRole('SHIFT_LEADER'))) || (hasRole('ADMIN') || (hasRole('MANAGER') || hasRole('SHIFT_LEADER')))) && (
                      <button
                        onClick={() => handleOpenEditModal(station)}
                        className="p-1.5 text-slate-600 hover:text-blue-600 rounded hover:bg-white transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {(hasRole('ADMIN') || (hasRole('ADMIN') || (hasRole('MANAGER') || hasRole('SHIFT_LEADER')))) && (
                      <button
                        onClick={() => handleOpenDeleteModal(station)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-white transition-colors"
                        title="Xóa mềm Trạm 110kV"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Substation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingStation ? `Chỉnh sửa Trạm: ${editingStation.name}` : 'Thêm mới Trạm Biến áp 110kV'}
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
                  <label className="block font-bold text-slate-700 mb-1">Mã Trạm 110kV *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: T110-E1.1"
                    value={formData.substation_code}
                    onChange={e => setFormData({ ...formData, substation_code: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Trạng thái vận hành</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold focus:outline-none focus:border-blue-500"
                  >
                    <option value="ACTIVE">Đang vận hành (ACTIVE)</option>
                    <option value="MAINTENANCE">Đang bảo dưỡng (MAINTENANCE)</option>
                    <option value="INACTIVE">Tạm dừng (INACTIVE)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên Trạm Biến áp *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Trạm 110kV E1.1 Nghĩa Đô"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Địa chỉ Trạm</label>
                <input
                  type="text"
                  placeholder="VD: Số 1 Phố Hoàng Quốc Việt, Cầu Giấy, Hà Nội"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Coordinates & GPS */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    Tọa độ Không gian GIS & Google Maps
                  </span>
                  <button
                    type="button"
                    onClick={handleGrabGps}
                    className="px-2.5 py-1 bg-blue-100 text-blue-700 font-bold rounded hover:bg-blue-200 transition-colors"
                  >
                    [ LẤY GPS HIỆN TẠI ]
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="21.0458"
                      value={formData.latitude}
                      onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-200 rounded font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="105.7925"
                      value={formData.longitude}
                      onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-200 rounded font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Google Maps URL</label>
                  <input
                    type="url"
                    placeholder="https://maps.google.com/?q=21.0458,105.7925"
                    value={formData.google_maps_url}
                    onChange={e => setFormData({ ...formData, google_maps_url: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-200 rounded text-slate-700 font-mono text-[11px] focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Hình ảnh đại diện (URL)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.image_url}
                  onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ghi chú vận hành</label>
                <textarea
                  rows={3}
                  placeholder="Nêu rõ quy mô máy biến áp, đặc điểm vận hành..."
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
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : editingStation ? 'Lưu cập nhật' : 'Tạo Trạm 110kV'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION & CONFLICT MODAL */}
      {deleteModalOpen && deletingStation && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 text-red-400">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-white text-sm">Xác Nhận Xóa Trạm Biến Áp 110kV</h3>
              </div>
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Station Summary Box */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-400 font-mono font-bold rounded text-[11px]">
                    {deletingStation.substation_code}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Trạng thái: <strong className="text-emerald-400">{deletingStation.status || 'ACTIVE'}</strong>
                  </span>
                </div>
                <h4 className="font-bold text-white text-sm">{deletingStation.name}</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                  <div>
                    <span className="text-slate-500 font-semibold block">ĐỊA CHỈ TRẠM:</span>
                    <div className="font-semibold text-white">{deletingStation.address || 'Chưa cập nhật'}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block">QUY MÔ VẬN HÀNH:</span>
                    <div className="text-slate-300">
                      Phát tuyến: <strong className="text-blue-400">{deletingStation.feeder_count || 0}</strong> | Thiết bị: <strong className="text-emerald-400">{deletingStation.device_count || 0}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notice Box about Soft Delete */}
              {!deleteError && (
                <div className="p-3 bg-blue-950/40 border border-blue-800/50 rounded-xl text-blue-300 flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed text-[11px]">
                    <strong>Quy trình XÓA MỀM (Soft Delete):</strong> Trạm 110kV sẽ chuyển sang trạng thái đã xóa và bị ẩn khỏi danh sách vận hành.
                    <br />
                    <span className="text-blue-200/80">
                      • Danh mục Phát tuyến, Thiết bị và Mạch khép vòng <strong>KHÔNG tự động bị xóa</strong>.
                      <br />
                      • Toàn bộ dữ liệu lịch sử, nhật ký công việc và báo cáo kiểm tra được lưu trữ an toàn.
                    </span>
                  </div>
                </div>
              )}

              {/* Conflict / Usage Error Alert */}
              {deleteError && (
                <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 space-y-3">
                  <div className="flex items-start space-x-2.5">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-white text-xs uppercase tracking-wider mb-1">CẢNH BÁO Xung Đột Dữ Liệu</h5>
                      <p className="text-[11px] leading-relaxed">{deleteError}</p>
                    </div>
                  </div>

                  {/* Render Detailed Usage lists if blocked */}
                  {deleteUsage && (
                    <div className="space-y-3 pt-2 border-t border-red-900/60 text-[11px]">
                      {/* Active Feeders */}
                      {deleteUsage.active_feeders && deleteUsage.active_feeders.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <strong className="text-amber-400 font-bold">
                              • Phát tuyến đang liên kết ({deleteUsage.active_feeders.length}):
                            </strong>
                            {onNavigateToFeeders && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteModalOpen(false);
                                  onNavigateToFeeders(deletingStation.id);
                                }}
                                className="text-blue-400 hover:underline font-bold text-[10px]"
                              >
                                [ XEM CÁC PHÁT TUYẾN ]
                              </button>
                            )}
                          </div>
                          <div className="bg-slate-950/80 p-2 rounded-lg border border-red-900/40 space-y-1">
                            {deleteUsage.active_feeders.map((f: any) => (
                              <div key={f.id} className="flex justify-between text-slate-300">
                                <span>[{f.feeder_code}] {f.name}</span>
                                <span className="text-emerald-400 font-bold">{f.status || 'ACTIVE'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Active Devices */}
                      {deleteUsage.active_devices && deleteUsage.active_devices.length > 0 && (
                        <div>
                          <strong className="text-amber-400 font-bold block mb-1">
                            • Thiết bị liên kết trực tiếp ({deleteUsage.active_devices.length}):
                          </strong>
                          <div className="bg-slate-950/80 p-2 rounded-lg border border-red-900/40 space-y-1 max-h-32 overflow-y-auto">
                            {deleteUsage.active_devices.map((d: any) => (
                              <div key={d.id} className="flex justify-between text-slate-300">
                                <span>[{d.device_id}] {d.name} ({d.device_type})</span>
                                <span className="text-blue-400 font-bold">{d.status || 'ACTIVE'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Active Loops */}
                      {deleteUsage.active_loops && deleteUsage.active_loops.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <strong className="text-amber-400 font-bold">
                              • Mạch khép vòng liên kết ({deleteUsage.active_loops.length}):
                            </strong>
                            <a
                              href="/loops"
                              onClick={() => setDeleteModalOpen(false)}
                              className="text-blue-400 hover:underline font-bold text-[10px]"
                            >
                              [ XEM KHÉP VÒNG ]
                            </a>
                          </div>
                          <div className="bg-slate-950/80 p-2 rounded-lg border border-red-900/40 space-y-1">
                            {deleteUsage.active_loops.map((l: any) => (
                              <div key={l.id} className="flex justify-between text-slate-300">
                                <span>[{l.loop_id}] {l.name}</span>
                                <span className="text-amber-400 font-bold">{l.status || 'ACTIVE'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Active Tasks */}
                      {deleteUsage.active_tasks && deleteUsage.active_tasks.length > 0 && (
                        <div>
                          <strong className="text-amber-400 font-bold block mb-1">
                            • Công việc vận hành đang thực hiện ({deleteUsage.active_tasks.length}):
                          </strong>
                          <div className="bg-slate-950/80 p-2 rounded-lg border border-red-900/40 space-y-1">
                            {deleteUsage.active_tasks.map((task: any) => (
                              <div key={task.id} className="flex justify-between text-slate-300">
                                <span>[{task.task_code}] {task.title}</span>
                                <span className="text-blue-400 font-bold">{task.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Active Issues */}
                      {deleteUsage.active_issues && deleteUsage.active_issues.length > 0 && (
                        <div>
                          <strong className="text-amber-400 font-bold block mb-1">
                            • Bất thường / Khiếm khuyết chưa hoàn thành ({deleteUsage.active_issues.length}):
                          </strong>
                          <div className="bg-slate-950/80 p-2 rounded-lg border border-red-900/40 space-y-1">
                            {deleteUsage.active_issues.map((iss: any) => (
                              <div key={iss.id} className="flex justify-between text-slate-300">
                                <span>[{iss.issue_code}] {iss.title}</span>
                                <span className="text-red-400 font-bold">{iss.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Active Schedules */}
                      {deleteUsage.active_schedules && deleteUsage.active_schedules.length > 0 && (
                        <div>
                          <strong className="text-amber-400 font-bold block mb-1">
                            • Lịch kiểm tra định kỳ đang hoạt động ({deleteUsage.active_schedules.length}):
                          </strong>
                          <div className="bg-slate-950/80 p-2 rounded-lg border border-red-900/40 space-y-1">
                            {deleteUsage.active_schedules.map((sch: any) => (
                              <div key={sch.id} className="flex justify-between text-slate-300">
                                <span>[{sch.schedule_code}] {sch.title}</span>
                                <span className="text-emerald-400 font-bold">{sch.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
              >
                {deleteError ? 'Đã Hiểu & Đóng' : 'Hủy Bỏ'}
              </button>

              {!deleteError && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDeleteSubstation}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 text-xs transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'Đang xử lý xóa...' : 'Xác Nhận Xóa Mềm'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* DETAIL MODAL */}
      {detailStation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">Chi tiết Trạm: {detailStation.name}</h3>
              <button onClick={() => setDetailStation(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
              <img src={detailStation.image_url || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'} alt={detailStation.name} className="w-full h-48 object-cover rounded-xl" />
              <div className="grid grid-cols-2 gap-4">
                <div><span className="font-bold">Mã Trạm:</span> {detailStation.substation_code}</div>
                <div><span className="font-bold">Trạng thái:</span> {detailStation.status}</div>
              </div>
              <div><span className="font-bold">Địa chỉ:</span> {detailStation.address || 'Chưa cập nhật'}</div>
              <div><span className="font-bold">Ghi chú:</span> {detailStation.notes || 'Không có'}</div>
              <div className="grid grid-cols-2 gap-4">
                <div><span className="font-bold">Phát tuyến:</span> {detailStation.feeder_count || 0}</div>
                <div><span className="font-bold">Thiết bị:</span> {detailStation.device_count || 0}</div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 text-right">
              <button onClick={() => setDetailStation(null)} className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
