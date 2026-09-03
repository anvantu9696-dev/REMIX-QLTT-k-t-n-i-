import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, Plus, Search, Building2, GitCommitHorizontal, MapPin, Edit2, Trash2, Eye, AlertCircle, X, CheckCircle2, ExternalLink, ShieldAlert, Activity, Layers, Check, AlertTriangle, Radio, Download, Compass, LayoutGrid, List, Upload, Camera, QrCode } from 'lucide-react';
import { api } from '../lib/api';
import { normalizeDeviceRelations } from '../utils/deviceNormalizer';
import { Device, Substation, Feeder, DeviceType, SwitchStatus, ScadaStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { DeviceProposalModal } from '../components/devices/DeviceProposalModal';
import { GeoCameraCaptureModal } from '../components/devices/GeoCameraCaptureModal';
import { ZaloQRShareModal } from '../components/devices/ZaloQRShareModal';
import { DeviceCard } from '../components/devices/DeviceCard';
import { BulkActionsBar } from '../components/devices/BulkActionsBar';
import { BulkStatusModal } from '../components/devices/BulkStatusModal';
import { BulkExportModal } from '../components/devices/BulkExportModal';
import { useRealtimeSync } from '../lib/realtime';
import { DEVICE_IMAGE_FEATURE_ENABLED } from '../../server/config';
interface DevicesPageProps {
  onNavigateToDetail: (deviceId: number | string) => void;
  initialFeederId?: number | string;
}
export const DevicesPage: React.FC<DevicesPageProps> = ({ onNavigateToDetail, initialFeederId }) => {
  const { user, isGuest, hasRole } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [feeders, setFeeders] = useState<Feeder[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const feedersCache = useRef<Record<string, Feeder[]>>({});
  const [formFeeders, setFormFeeders] = useState<Feeder[]>([]);
  const getNormalizedRelations = useCallback((device: Device) => {
    return normalizeDeviceRelations(device, substations, feeders);
  }, [substations, feeders]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkStatusModalOpen, setBulkStatusModalOpen] = useState(false);
  const [bulkExportModalOpen, setBulkExportModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [feederFilter, setFeederFilter] = useState<string>(initialFeederId ? String(initialFeederId) : '');
  useEffect(() => {
    if (initialFeederId !== undefined) {
      setFeederFilter(String(initialFeederId));
    } else {
      setFeederFilter('');
    }
  }, [initialFeederId]);
  const [typeFilter, setTypeFilter] = useState('');
  const [switchFilter, setSwitchFilter] = useState('');
  const [scadaFilter, setScadaFilter] = useState('');
  const [batteryFilter, setBatteryFilter] = useState('');
  const [sortBy, setSortBy] = useState<string>('device_id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [totalDevicesCount, setTotalDevicesCount] = useState<number>(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [proposalMode, setProposalMode] = useState<'CREATE' | 'UPDATE' | 'LOCATION' | 'STATUS' | 'DELETE' | 'IMAGE'>('CREATE');
  const [proposalTargetDevice, setProposalTargetDevice] = useState<any>(null);
  const [geoCameraModalOpen, setGeoCameraModalOpen] = useState(false);
  const [geoCameraDevice, setGeoCameraDevice] = useState<Device | null>(null);
  const [zaloQRModalOpen, setZaloQRModalOpen] = useState(false);
  const [zaloQRDevice, setZaloQRDevice] = useState<Device | null>(null);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [formData, setFormData] = useState({
    device_id: '',
    device_code: '',
    name: '',
    device_type: 'LBS' as DeviceType,
    pole_number: '',
    substation_id: '',
    feeder_id: '',
    unit: 'Công ty Điện lực 1',
    team: 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
    status: 'ACTIVE',
    switch_status: 'CLOSED' as SwitchStatus,
    scada_status: 'SIGNAL' as ScadaStatus,
    relay_79: 'N_A',
    battery_status: 'UNCHECKED',
    latitude: '',
    longitude: '',
    google_maps_url: '',
    primary_image: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80',
    notes: '',
    current_setting: ''
  });
  const [idChecking, setIdChecking] = useState(false);
  const [idConflict, setIdConflict] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<{
    loops: any[];
    tasks: any[];
    issues: any[];
    schedules: any[];
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  useEffect(() => {
    const init = async () => {
      await fetchMetadata();
      await fetchDevices({ limit: 10 });
    };
    init();
  }, []);
  useEffect(() => {
    if (substations.length > 0 || feeders.length > 0) {
      fetchDevices({ limit: 10 });
    }
  }, [search, stationFilter, feederFilter, typeFilter, switchFilter, scadaFilter, batteryFilter]);

  const fetchFeedersBySubstation = async (subId: string) => {
    if (!subId) {
      setFormFeeders([]);
      return;
    }
    if (feedersCache.current[subId]) {
      setFormFeeders(feedersCache.current[subId]);
      return;
    }
    try {
      let allFeeders: Feeder[] = [];
      let lastDocId: string | undefined = undefined;
      while (true) {
        const res = await api.getFeeders({ substation_id: subId, limit: 100, lastDocId });
        if (res.success && res.data.length > 0) {
          allFeeders = [...allFeeders, ...res.data];
          if (res.nextCursor) {
            lastDocId = res.nextCursor;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      feedersCache.current[subId] = allFeeders;
      setFormFeeders(allFeeders);
    } catch (e) {
      console.error('Lỗi tải phát tuyến:', e);
    }
  };

  const fetchMetadata = async () => {
    try {
      let allSubs: Substation[] = [];
      let lastDocId: string | undefined = undefined;
      while (true) {
        const stRes = await api.getSubstations({ limit: 100, lastDocId });
        if (stRes.success && stRes.data.length > 0) {
          allSubs = [...allSubs, ...stRes.data];
          if (stRes.nextCursor) {
            lastDocId = stRes.nextCursor;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      setSubstations(allSubs);

      const allDevRes = await api.getDevices({ limit: 10 });
      if (allDevRes.success) setTotalDevicesCount(allDevRes.data.length);
    } catch (e) {
      console.error(e);
    }
  };
  const fetchDevices = async (options?: any) => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (stationFilter) params.substation_id = stationFilter;
      if (feederFilter) params.feeder_id = feederFilter;
      if (typeFilter) params.type = typeFilter;
      if (switchFilter) params.switch_status = switchFilter;
      if (scadaFilter) params.scada_status = scadaFilter;
      if (batteryFilter) params.battery_status = batteryFilter;
      params.limit = 10;
      const res = await api.getDevices(params);
      if (res.success) {
        setDevices(res.data);
        setNextCursor(res.nextCursor || null);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách thiết bị');
    } finally {
      setLoading(false);
    }
  };
  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (stationFilter) params.substation_id = stationFilter;
      if (feederFilter) params.feeder_id = feederFilter;
      if (typeFilter) params.type = typeFilter;
      if (switchFilter) params.switch_status = switchFilter;
      if (scadaFilter) params.scada_status = scadaFilter;
      if (batteryFilter) params.battery_status = batteryFilter;
      params.limit = 10;
      params.lastDocId = nextCursor;
      const res = await api.getDevices(params);
      if (res.success) {
        setDevices(prev => [...prev, ...res.data]);
        setNextCursor(res.nextCursor || null);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải thêm thiết bị');
    } finally {
      setLoadingMore(false);
    }
  };
  const checkDeviceIdUnique = useCallback(async (idVal: string, excludeDbId?: number) => {
    if (!idVal || !idVal.trim()) {
      setIdConflict(null);
      return;
    }
    setIdChecking(true);
    try {
      const res = await api.checkDeviceId((idVal || '').trim(), excludeDbId);
      if (res.exists) {
        setIdConflict(`Mã thiết bị (DEVICE_ID) "${idVal}" đã tồn tại trên hệ thống (${res.device?.name || 'Trùng lặp'})!`);
      } else {
        setIdConflict(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIdChecking(false);
    }
  }, []);
  const handleDeviceIdChange = (val: string) => {
    setFormData(prev => ({ ...prev, device_id: val.toUpperCase() }));
    checkDeviceIdUnique(val.toUpperCase(), editingDevice ? editingDevice.id : undefined);
  };
  const handleOpenAddModal = () => {
    if (isGuest()) return;
    setEditingDevice(null);
    setIdConflict(null);
    setFormData({
      device_id: 'LBS-',
      device_code: '',
      name: '',
      device_type: 'LBS',
      pole_number: 'Trụ ',
      substation_id: substations[0] ? String(substations[0].id) : '',
      feeder_id: feeders[0] ? String(feeders[0].id) : '',
      unit: 'Công ty Điện lực 1',
      team: 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      status: 'ACTIVE',
      switch_status: 'CLOSED',
      scada_status: 'SIGNAL',
      relay_79: 'N_A',
      battery_status: 'UNCHECKED',
      latitude: '',
      longitude: '',
      google_maps_url: '',
      primary_image: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80',
      notes: '',
      current_setting: ''
    });
    setFormError('');
    setModalOpen(true);
  };
  const handleOpenEditModal = (device: Device) => {
    if (isGuest()) return;
    setEditingDevice(device);
    setIdConflict(null);
    setFormData({
      device_id: device.device_id,
      device_code: device.device_code || '',
      name: device.name,
      device_type: device.device_type,
      pole_number: device.pole_number || '',
      substation_id: device.substation_id ? String(device.substation_id) : '',
      feeder_id: device.feeder_id ? String(device.feeder_id) : '',
      unit: device.unit || 'Công ty Điện lực 1',
      team: device.team || 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      status: device.status || 'ACTIVE',
      switch_status: device.switch_status || 'CLOSED',
      scada_status: device.scada_status || 'SIGNAL',
      relay_79: device.relay_79 || 'N_A',
      battery_status: device.battery_status || 'UNCHECKED',
      latitude: device.latitude ? String(device.latitude) : '',
      longitude: device.longitude ? String(device.longitude) : '',
      google_maps_url: device.google_maps_url || '',
      primary_image: device.primary_image || 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80',
      notes: device.notes || '',
      current_setting: device.current_setting || ''
    });
    setFormError('');
    setModalOpen(true);
  };
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!(formData.device_id || '').trim() || !(formData.name || '').trim()) {
      setFormError('Mã DEVICE_ID và Tên thiết bị không được để trống.');
      return;
    }
    if (idConflict) {
      setFormError('Không thể lưu do trùng mã DEVICE_ID! Vui lòng đặt mã khác.');
      return;
    }
    if (formData.substation_id && formData.feeder_id) {
        const feeder = feeders.find(f => String(f.id) === String(formData.feeder_id));
        if (feeder && String(feeder.substation_id) !== String(formData.substation_id)) {
            setFormError('Phát tuyến đã chọn không thuộc Trạm 110kV đã chọn!');
            return;
        }
    }
    setSubmitting(true);
    try {
      if (editingDevice) {
        await api.updateDevice(editingDevice.id, formData);
        setSuccess(`Đã cập nhật thông tin thiết bị ${formData.name}`);
      } else {
        await api.createDevice(formData);
        setSuccess(`Đã tạo thành công thiết bị ${formData.name}`);
      }
      setModalOpen(false);
      fetchDevices({ limit: 10 });
    } catch (err: any) {
      setFormError(err.message || 'Lỗi lưu dữ liệu thiết bị');
    } finally {
      setSubmitting(false);
    }
  };
  const handleDelete = (device: Device) => {
    if (isGuest()) return;
    setDeletingDevice(device);
    setDeleteError(null);
    setDeleteUsage(null);
    setIsDeleting(false);
    setDeleteModalOpen(true);
  };
  const confirmDelete = async () => {
    if (!deletingDevice) return;
    setIsDeleting(true);
    setDeleteError(null);
    setDeleteUsage(null);
    try {
      const res = await api.deleteDevice(deletingDevice.id);
      setSuccess(res.message || `Đã xóa mềm thành công thiết bị ${deletingDevice.name}`);
      setDeleteModalOpen(false);
      fetchDevices({ limit: 10 });
    } catch (err: any) {
      if (err.status === 409 || err.usage || err.data?.usage) {
        setDeleteError(err.data?.message || err.message || 'Không thể xóa thiết bị vì thiết bị đang được sử dụng trong hệ thống.');
        setDeleteUsage(err.usage || err.data?.usage || { loops: [], tasks: [], issues: [], schedules: [] });
      } else if (err.status === 403) {
        setDeleteError(err.message || 'Bạn không có quyền xóa thiết bị này. (Yêu cầu quyền: equipment:delete)');
      } else {
        setDeleteError(err.message || 'Lỗi hệ thống khi thực hiện xóa thiết bị');
      }
    } finally {
      setIsDeleting(false);
    }
  };
  const handleGrabGps = () => {
    if (!navigator.geolocation) {
      setFormError('Trình duyệt không hỗ trợ Geolocation.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          google_maps_url: `https://maps.google.com/?q=${lat},${lng}`
        }));
      },
      (err) => setFormError(`Không thể lấy vị trí GPS: ${err.message}`)
    );
  };

  const handleExportCSV = () => {
    if (!devices || devices.length === 0) {
      alert('Không có dữ liệu để xuất CSV');
      return;
    }
    const headers = ["Mã thiết bị", "Tên thiết bị", "Loại thiết bị", "Vị trí trụ lắp đặt", "Trạm 110kV", "Phát tuyến", "Đơn vị", "Đội QLVH", "Trạng thái", "Trạng thái cắt", "SCADA", "Rơ le 79", "Dòng chỉnh định", "Vĩ độ (Lat)", "Kinh độ (Lng)", "Ghi chú"];
    const rows = devices.map(d => [
      `"${d.device_id || ''}"`,
      `"${d.name || ''}"`,
      `"${d.device_type || ''}"`,
      `"${d.pole_number || ''}"`,
      `"${d.substation_name || d.substation_code || ''}"`,
      `"${d.feeder_name || d.feeder_code || ''}"`,
      `"${d.unit || ''}"`,
      `"${d.team || ''}"`,
      `"${d.status || ''}"`,
      `"${d.switch_status || ''}"`,
      `"${d.scada_status || ''}"`,
      `"${d.relay_79 || ''}"`,
      `"${d.current_setting || ''}"`,
      `"${d.latitude || ''}"`,
      `"${d.longitude || ''}"`,
      `"${d.notes || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `danh_sach_thiet_bi_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const sortedDevices = React.useMemo(() => {
    return [...devices].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      if (sortBy === 'device_id') {
        valA = a.device_id || '';
        valB = b.device_id || '';
      } else if (sortBy === 'name') {
        valA = a.name || '';
        valB = b.name || '';
      } else if (sortBy === 'device_type') {
        valA = a.device_type || '';
        valB = b.device_type || '';
      } else if (sortBy === 'switch_status') {
        valA = a.switch_status || '';
        valB = b.switch_status || '';
      } else if (sortBy === 'scada_status') {
        valA = a.scada_status || '';
        valB = b.scada_status || '';
      } else if (sortBy === 'battery_status') {
        valA = a.battery_status || '';
        valB = b.battery_status || '';
      } else if (sortBy === 'pole_number') {
        valA = a.pole_number || '';
        valB = b.pole_number || '';
      } else {
        valA = String(a.id || '');
        valB = String(b.id || '');
      }
      const numA = parseFloat(valA);
      const numB = parseFloat(valB);
      if (!isNaN(numA) && !isNaN(numB) && String(valA).trim() !== '' && String(valB).trim() !== '') {
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }
      const cmp = String(valA).localeCompare(String(valB), 'vi', { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [devices, sortBy, sortOrder]);
  const handleSortField = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };
  const isAllSelected = sortedDevices.length > 0 && sortedDevices.every(d => selectedIds.includes(d.id));
  const isIndeterminate = sortedDevices.some(d => selectedIds.includes(d.id)) && !isAllSelected;
  const headerCheckboxRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedDevices.map(d => d.id));
    }
  };
  const handleToggleSelectDevice = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };
  const handleClearSelection = () => {
    setSelectedIds([]);
  };
  const handleSelectAllFiltered = () => {
    setSelectedIds(sortedDevices.map(d => d.id));
  };
  const selectedDevices = devices.filter(d => selectedIds.includes(d.id));
  const handleQuickUpdateStatus = async (updates: any, reason: string) => {
    try {
      const res = await api.bulkUpdateDevices({
        device_ids: selectedIds,
        updates,
        reason
      });
      if (res.success) {
        setSuccess(res.message || `Đã cập nhật ${selectedIds.length} thiết bị.`);
        fetchDevices({ limit: 10 });
        setSelectedIds([]);
      } else {
        setError(res.message || 'Cập nhật trạng thái thất bại');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật trạng thái');
    }
  };
  return (
    <div className="space-y-6">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Quản lý Thiết bị</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Danh mục Recloser (REC), Cầu dao phụ tải (LBS), Cầu dao cách ly (DS), Tủ RMU. Đảm bảo duy nhất mã <span className="font-mono font-bold text-slate-700">DEVICE_ID</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-300 mr-2">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
              title="Danh sách"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded ${viewMode === 'card' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
              title="Dạng thẻ"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors border border-slate-300 shadow-sm"
            title="Xuất danh sách thiết bị ra tập tin CSV"
          >
            <Download className="w-4 h-4 text-slate-600" />
            Xuất CSV
          </button>
          {!isGuest() && (
            <button
              onClick={() => {
                setProposalTargetDevice(null);
                setProposalMode('CREATE');
                setProposalModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold transition-colors shadow-sm"
              title="Gửi đề xuất thêm mới thiết bị (Dành cho Nhân viên vận hành)"
            >
              <Plus className="w-4 h-4" />
              Gửi Đề xuất Thêm mới
            </button>
          )}
          {!isGuest() && (hasRole('ADMIN') || user?.roles?.includes('ADMIN')) && (
            <button
              onClick={() => {
                window.history.pushState({}, '', '/import');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-xs font-bold transition-colors shadow-sm"
              title="Nhập dữ liệu thiết bị hàng loạt từ Excel/CSV"
            >
              <Upload className="w-4 h-4" />
              + Nhập Dữ Liệu
            </button>
          )}
          {!isGuest() && (hasRole('ADMIN') || hasRole('MANAGER')) && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Thêm Trực tiếp (Admin)
            </button>
          )}
        </div>
      </div>
      {}
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
      {}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm mã DEVICE_ID, Tên, Vị trí trụ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={stationFilter}
          onChange={e => { setStationFilter(e.target.value); setFeederFilter(''); }}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
        >
          <option value="">Tất cả Trạm 110kV</option>
          {substations.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={feederFilter}
          onChange={e => setFeederFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
        >
          <option value="">Tất cả Phát tuyến</option>
          {feeders
            .filter(f => !stationFilter || String(f.substation_id) === String(stationFilter))
            .map(f => (
              <option key={f.id} value={f.id}>{f.name} ({f.feeder_code})</option>
            ))}
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
        >
          <option value="">Tất cả loại thiết bị</option>
          <option value="LBS">LBS (Cầu dao phụ tải)</option>
          <option value="REC">REC (Máy cắt / Recloser)</option>
          <option value="DS">DS (Cầu dao cách ly)</option>
          <option value="RMU">RMU (Tủ trung thế)</option>
          <option value="OTHER">Khác</option>
        </select>
        <select
          value={switchFilter}
          onChange={e => setSwitchFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="CLOSED">Đóng (CLOSED)</option>
          <option value="OPEN">Mở (OPEN)</option>
          <option value="UNKNOWN">Chưa xác định</option>
        </select>
        <select
          value={scadaFilter}
          onChange={e => setScadaFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
        >
          <option value="">Tất cả SCADA</option>
          <option value="SIGNAL">Có tín hiệu</option>
          <option value="NO_SIGNAL">Mất tín hiệu</option>
        </select>
        <select
          value={batteryFilter}
          onChange={e => setBatteryFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
        >
          <option value="">Tất cả tình trạng ắc quy</option>
          <option value="GOOD">Tốt</option>
          <option value="WEAK">Yếu</option>
          <option value="BROKEN">Hỏng</option>
          <option value="REPLACING">Đang thay</option>
          <option value="UNCHECKED">Chưa kiểm tra</option>
        </select>
        <button
          onClick={() => {
            setSearch('');
            setStationFilter('');
            setFeederFilter('');
            setTypeFilter('');
            setSwitchFilter('');
            setScadaFilter('');
            setBatteryFilter('');
          }}
          className="bg-white border border-slate-300 text-slate-600 rounded-lg px-3 py-2 text-xs font-bold hover:bg-slate-50 focus:outline-none focus:border-red-500"
        >
          Xóa bộ lọc
        </button>
      </div>
      {}
      {(search || stationFilter || feederFilter || typeFilter || switchFilter || scadaFilter || batteryFilter) && (
        <div className="flex flex-wrap items-center gap-2 my-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <span className="font-bold text-slate-500">Bộ lọc đang áp dụng:</span>
          {search && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
              Từ khóa: "{search}"
              <button onClick={() => setSearch('')} className="hover:text-blue-900 font-bold ml-1">×</button>
            </span>
          )}
          {stationFilter && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
              Trạm: {substations.find(s => String(s.id) === String(stationFilter))?.name || stationFilter}
              <button onClick={() => { setStationFilter(''); setFeederFilter(''); }} className="hover:text-blue-900 font-bold ml-1">×</button>
            </span>
          )}
          {feederFilter && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
              Phát tuyến: {feeders.find(f => String(f.id) === String(feederFilter))?.name || feederFilter}
              <button onClick={() => setFeederFilter('')} className="hover:text-blue-900 font-bold ml-1">×</button>
            </span>
          )}
          {typeFilter && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
              Loại: {typeFilter}
              <button onClick={() => setTypeFilter('')} className="hover:text-blue-900 font-bold ml-1">×</button>
            </span>
          )}
          {switchFilter && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
              Đóng/Cắt: {switchFilter === 'CLOSED' ? 'Đóng' : switchFilter === 'OPEN' ? 'Mở' : 'Không xác định'}
              <button onClick={() => setSwitchFilter('')} className="hover:text-blue-900 font-bold ml-1">×</button>
            </span>
          )}
          {scadaFilter && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
              SCADA: {scadaFilter === 'SIGNAL' ? 'Có tín hiệu' : 'Mất tín hiệu'}
              <button onClick={() => setScadaFilter('')} className="hover:text-blue-900 font-bold ml-1">×</button>
            </span>
          )}
          {batteryFilter && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
              Ắc quy: {batteryFilter}
              <button onClick={() => setBatteryFilter('')} className="hover:text-blue-900 font-bold ml-1">×</button>
            </span>
          )}
          <button
            onClick={() => {
              setSearch('');
              setStationFilter('');
              setFeederFilter('');
              setTypeFilter('');
              setSwitchFilter('');
              setScadaFilter('');
              setBatteryFilter('');
            }}
            className="text-red-600 font-bold hover:underline ml-auto"
          >
            Xóa tất cả bộ lọc
          </button>
        </div>
      )}
      <div className="text-xs font-semibold text-slate-600 mt-2 mb-4">
        Đang hiển thị {devices.length} thiết bị
      </div>
      {}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Sắp xếp theo:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="device_id">Mã thiết bị (DEVICE_ID)</option>
            <option value="name">Tên thiết bị</option>
            <option value="device_type">Loại thiết bị</option>
            <option value="switch_status">Trạng thái Đóng/Cắt</option>
            <option value="scada_status">Tín hiệu SCADA</option>
            <option value="battery_status">Tình trạng ắc quy</option>
            <option value="pole_number">Số trụ / Giá trị số (Numerical)</option>
          </select>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg font-bold text-slate-700 transition-colors flex items-center gap-1"
            title="Đổi chiều sắp xếp"
          >
            {sortOrder === 'asc' ? 'Tăng dần (A-Z) ▲' : 'Giảm dần (Z-A) ▼'}
          </button>
        </div>
        <div className="text-slate-500 font-medium">
          Đang hiển thị <span className="font-bold text-slate-800">{sortedDevices.length}</span> kết quả đã lọc
        </div>
      </div>
      {}
      <BulkActionsBar
        selectedCount={selectedIds.length}
        totalFilteredCount={sortedDevices.length}
        onSelectAllFiltered={handleSelectAllFiltered}
        onClearSelection={handleClearSelection}
        onOpenBulkStatusModal={() => setBulkStatusModalOpen(true)}
        onOpenBulkExportModal={() => setBulkExportModalOpen(true)}
        onQuickUpdateStatus={handleQuickUpdateStatus}
        canUpdate={!isGuest() && (hasRole('ADMIN') || hasRole('MANAGER'))}
      />
      {}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center text-slate-500 text-xs font-medium">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mr-2" />
            Đang tải dữ liệu thiết bị...
          </div>
        ) : sortedDevices.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Zap className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-semibold">Không tìm thấy thiết bị nào phù hợp</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-300 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3 px-3 text-center w-11">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 text-blue-600 rounded border-slate-700 focus:ring-blue-500 cursor-pointer"
                      title={isAllSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                    />
                  </th>
                  <th className="py-3 px-4">DEVICE_ID</th>
                  <th className="py-3 px-4">Tên Thiết Bị / Vị Trí</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Loại</th>
                  <th className="py-3 px-4 hidden md:table-cell">Trạm & Phát Tuyến</th>
                  <th className="py-3 px-4 text-center">Trạng Thái Đóng/Cắt</th>
                  <th className="py-3 px-4 text-center hidden lg:table-cell">SCADA (Hiển thị)</th>
                  <th className="py-3 px-4 text-center hidden xl:table-cell">Ắc Quy (LBS/REC)</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {sortedDevices.map(device => {
                  const isSelected = selectedIds.includes(device.id);
                  return (
                    <tr
                      key={device.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-blue-50/80 hover:bg-blue-100/70' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectDevice(device.id)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                        {device.device_id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{device.name}</div>
                        <div className="text-[11px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                          <span>Vị trí trụ: <strong className="text-slate-700">{device.pole_number || 'N/A'}</strong></span>
                          {device.latitude && device.longitude && (
                            <span className="text-blue-600 font-mono text-[10px] inline-flex items-center gap-0.5">
                              <MapPin className="w-3 h-3" /> GIS
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 hidden sm:table-cell">
                        <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                          (device.device_type === 'RCL' || device.device_type === 'REC') ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                          device.device_type === 'LBS' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          device.device_type === 'RMU' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {device.device_type === 'RCL' ? 'REC' : device.device_type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[11px] hidden md:table-cell">
                        <div className="font-semibold text-slate-800 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{getNormalizedRelations(device).substationName}</span>
                        </div>
                        <div className="text-slate-500 flex items-center gap-1 mt-0.5">
                          <GitCommitHorizontal className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{getNormalizedRelations(device).feederName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          device.switch_status === 'CLOSED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          device.switch_status === 'OPEN' ? 'bg-red-100 text-red-800 border border-red-300' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          <span className={`w-2 h-2 rounded-full mr-1.5 ${
                            device.switch_status === 'CLOSED' ? 'bg-emerald-600' :
                            device.switch_status === 'OPEN' ? 'bg-red-600' : 'bg-gray-400'
                          }`} />
                          {device.switch_status === 'CLOSED' ? 'ĐANG ĐÓNG' : device.switch_status === 'OPEN' ? 'ĐANG MỞ' : 'KHÔNG RÕ'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center hidden lg:table-cell">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          device.scada_status === 'SIGNAL' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          device.scada_status === 'NO_SIGNAL' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-slate-50 text-slate-600'
                        }`}>
                          <Radio className="w-3 h-3 animate-pulse" />
                          {device.scada_status === 'SIGNAL' ? 'CÓ TÍN HIỆU' : device.scada_status === 'NO_SIGNAL' ? 'MẤT TÍN HIỆU' : 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center hidden xl:table-cell">
                        {(device.device_type === 'LBS' || device.device_type === 'RCL' || device.device_type === 'REC') ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            device.battery_status === 'GOOD' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            device.battery_status === 'WEAK' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            device.battery_status === 'BROKEN' ? 'bg-red-50 text-red-700 border border-red-200' :
                            device.battery_status === 'REPLACING' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            'bg-slate-50 text-slate-600 border border-slate-200'
                          }`}>
                            {device.battery_status === 'GOOD' ? 'TỐT' :
                             device.battery_status === 'WEAK' ? 'YẾU' :
                             device.battery_status === 'BROKEN' ? 'HỎNG' :
                             device.battery_status === 'REPLACING' ? 'ĐANG THAY' : 'CHƯA KIỂM TRA'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              if (device.latitude != null && device.longitude != null && !isNaN(Number(device.latitude)) && !isNaN(Number(device.longitude))) {
                                const lat = Number(device.latitude);
                                const lng = Number(device.longitude);
                                if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                                  return;
                                }
                              }
                              if (device.google_maps_url && typeof device.google_maps_url === 'string' && device.google_maps_url.trim().length > 0) {
                                const gUrl = device.google_maps_url.trim();
                                if (gUrl.startsWith('http://') || gUrl.startsWith('https://')) {
                                  window.open(gUrl, '_blank');
                                  return;
                                } else {
                                  alert('Liên kết Google Maps của thiết bị không hợp lệ.');
                                  return;
                                }
                              }
                              alert('Thiết bị chưa được cập nhật vị trí.');
                            }}
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 rounded hover:bg-emerald-50"
                            title="Chỉ đường đến thiết bị"
                          >
                            <Compass className="w-4 h-4" />
                          </button>
                          {DEVICE_IMAGE_FEATURE_ENABLED && (
                              <button
                                onClick={() => {
                                  setGeoCameraDevice(device);
                                  setGeoCameraModalOpen(true);
                                }}
                                className="p-1.5 text-cyan-600 hover:text-cyan-800 rounded hover:bg-cyan-50"
                                title="Chụp ảnh định vị GPS trực tiếp"
                              >
                                <Camera className="w-4 h-4" />
                              </button>
                          )}
                          <button
                            onClick={() => {
                              setZaloQRDevice(device);
                              setZaloQRModalOpen(true);
                            }}
                            className="p-1.5 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50"
                            title="Chia sẻ thông tin qua Zalo và mã QR"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onNavigateToDetail(device.id)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50"
                            title="Xem Chi tiết & Lịch sử"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!isGuest() && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(device)}
                                className="p-1.5 text-slate-600 hover:text-blue-600 rounded hover:bg-slate-100"
                                title="Sửa thiết bị"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(device)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100"
                                title="Xóa mềm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
            {sortedDevices.map(device => (
              <DeviceCard 
                key={device.id} 
                device={device} 
                onNavigateToDetail={onNavigateToDetail}
                onEdit={handleOpenEditModal}
                onDelete={handleDelete}
                isGuest={isGuest()}
                hasRole={hasRole}
                isSelected={selectedIds.includes(device.id)}
                onToggleSelect={handleToggleSelectDevice}
                getNormalizedRelations={getNormalizedRelations}
              />
            ))}
          </div>
        )}
        {nextCursor && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center transition-colors shadow-sm"
            >
              {loadingMore ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang tải...
                </>
              ) : (
                'Tải thêm thiết bị'
              )}
            </button>
          </div>
        )}
      </div>
      {}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingDevice ? `Chỉnh sửa Thiết bị: ${editingDevice.name}` : 'Thêm mới Thiết bị Lưới điện'}
                </h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              {}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                <label className="block font-bold text-blue-900 text-xs">
                  Mã Định Danh Duy Nhất (DEVICE_ID) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="VD: LBS-471-01"
                    value={formData.device_id}
                    onChange={e => handleDeviceIdChange(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                  {idChecking && (
                    <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">Đang kiểm tra...</span>
                  )}
                </div>
                {idConflict ? (
                  <div className="p-2 bg-red-100 border border-red-300 text-red-800 rounded font-bold text-[11px] flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{idConflict}</span>
                  </div>
                ) : (formData.device_id || '').trim() ? (
                  <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Mã DEVICE_ID hợp lệ và khả dụng trên hệ thống.</span>
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tên Thiết Bị *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Recloser LBS 471 Trụ 12"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Loại Thiết Bị</label>
                  <select
                    value={formData.device_type}
                    onChange={e => setFormData({ ...formData, device_type: e.target.value as DeviceType })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold focus:outline-none focus:border-blue-500"
                  >
                    <option value="LBS">LBS (Cầu dao phụ tải)</option>
                    <option value="REC">REC (Recloser / Máy cắt)</option>
                    <option value="DS">DS (Cầu dao cách ly)</option>
                    <option value="RMU">RMU (Tủ trung thế)</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Trạm 110kV</label>
                  <select
                    value={formData.substation_id || ''}
                    onChange={async (e) => {
                      const newSubId = e.target.value;
                      const oldSubId = formData.substation_id;
                      if (String(newSubId) !== String(oldSubId)) {
                        setFormData(prev => ({ 
                          ...prev, 
                          substation_id: newSubId, 
                          feeder_id: '' 
                        }));
                        await fetchFeedersBySubstation(newSubId);
                      }
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Chưa gán Trạm --</option>
                    {substations.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phát Tuyến</label>
                  <select
                    value={formData.feeder_id}
                    onChange={e => setFormData({ ...formData, feeder_id: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Chưa gán Phát tuyến --</option>
                    {formFeeders.map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.feeder_code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vị trí trụ lắp đặt</label>
                  <input
                    type="text"
                    placeholder="VD: Trụ 12"
                    value={formData.pole_number}
                    onChange={e => setFormData({ ...formData, pole_number: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              {(formData.device_type === 'LBS' || formData.device_type === 'REC') && (
                <div className="grid grid-cols-1 sm:grid-cols-1 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Dòng chỉnh định</label>
                    <input
                      type="text"
                      placeholder="VD: 300A, 400A..."
                      value={formData.current_setting || ''}
                      onChange={e => setFormData({ ...formData, current_setting: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
              {}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-xs">Trạng thái Đóng/Cắt</label>
                  <select
                    value={formData.switch_status}
                    onChange={e => setFormData({ ...formData, switch_status: e.target.value as SwitchStatus })}
                    className="w-full p-2 bg-white border border-slate-200 rounded text-xs font-bold focus:outline-none focus:border-blue-500"
                  >
                    <option value="CLOSED">CLOSED (Đóng)</option>
                    <option value="OPEN">OPEN (Mở / Cắt)</option>
                    <option value="UNKNOWN">UNKNOWN (Chưa rõ)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-xs">Tín hiệu SCADA (Chỉ xem)</label>
                  <select
                    value={formData.scada_status}
                    onChange={e => setFormData({ ...formData, scada_status: e.target.value as ScadaStatus })}
                    className="w-full p-2 bg-white border border-slate-200 rounded text-xs font-bold focus:outline-none focus:border-blue-500"
                  >
                    <option value="SIGNAL">CÓ TÍN HIỆU</option>
                    <option value="NO_SIGNAL">KHÔNG CÓ TÍN HIỆU</option>
                    <option value="UNKNOWN">CHƯA XÁC ĐỊNH</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-xs">Rơ le Tự đóng lại 79</label>
                  <select
                    value={formData.relay_79}
                    onChange={e => setFormData({ ...formData, relay_79: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-200 rounded text-xs font-bold focus:outline-none focus:border-blue-500"
                  >
                    <option value="ON">ON</option>
                    <option value="OFF">OFF</option>
                    <option value="N_A">CHƯA XÁC ĐỊNH</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-xs">Ắc quy (LBS/REC)</label>
                  <select
                    value={formData.battery_status || 'UNCHECKED'}
                    onChange={e => setFormData({ ...formData, battery_status: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-200 rounded text-xs font-bold focus:outline-none focus:border-blue-500"
                  >
                    <option value="GOOD">TỐT</option>
                    <option value="WEAK">YẾU</option>
                    <option value="BROKEN">HỎNG</option>
                    <option value="REPLACING">ĐANG THAY</option>
                    <option value="UNCHECKED">CHƯA KIỂM TRA</option>
                  </select>
                </div>
              </div>
              {}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    Vị trí Tọa độ GIS
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
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Google Maps Link</label>
                  <input
                    type="url"
                    placeholder="https://maps.google.com/?q=..."
                    value={formData.google_maps_url}
                    onChange={e => setFormData({ ...formData, google_maps_url: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-200 rounded font-mono text-[11px] focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Hình ảnh đại diện (URL)</label>
                <input
                  type="url"
                  value={formData.primary_image}
                  onChange={e => setFormData({ ...formData, primary_image: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Ghi chú thiết bị</label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú kỹ thuật..."
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
                  disabled={submitting || !!idConflict}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : editingDevice ? 'Lưu cập nhật' : 'Tạo Thiết bị'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {}
      {deleteModalOpen && deletingDevice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 space-y-5">
            {}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-100 text-red-600 rounded-xl">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Xác Nhận Xóa Thiết Bị Lưới Điện</h3>
                  <p className="text-[11px] text-slate-500">Mã thiết bị: <strong className="font-mono text-blue-600">{deletingDevice.device_id}</strong></p>
                </div>
              </div>
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Tên thiết bị:</span>
                <span className="font-bold text-slate-900">{deletingDevice.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Loại thiết bị:</span>
                <span className="font-bold text-blue-700">{deletingDevice.device_type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Trạm / Phát tuyến:</span>
                <span className="font-semibold text-slate-800">
                  {deletingDevice.substation_name || 'N/A'} - {deletingDevice.feeder_name || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Vị trí trụ lắp đặt:</span>
                <span className="font-semibold text-slate-800">{deletingDevice.pole_number || 'Chưa cập nhật'}</span>
              </div>
            </div>
            {}
            {!deleteUsage && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Quy trình XÓA MỀM (Soft Delete):</strong> Thiết bị sẽ chuyển sang trạng thái đã xóa nhưng toàn bộ dữ liệu lịch sử (Audit Log, Lịch sử vị trí, Lịch sử đóng/cắt, Công việc) sẽ được lưu trữ bảo toàn.
                </div>
              </div>
            )}
            {}
            {deleteError && (
              <div className="space-y-3">
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-800 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{deleteError}</span>
                </div>
                {deleteUsage && (
                  <div className="p-4 bg-red-50/50 border border-red-200 rounded-xl space-y-3 text-xs">
                    <p className="font-extrabold text-red-900 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-red-600" />
                      Chi tiết các mô-đun đang liên kết thiết bị:
                    </p>
                    {}
                    {deleteUsage.loops && deleteUsage.loops.length > 0 && (
                      <div className="space-y-1">
                        <span className="font-bold text-slate-800 block text-[11px] uppercase">Sơ đồ Khép vòng (Topology):</span>
                        <div className="space-y-1 pl-2">
                          {deleteUsage.loops.map((l: any) => (
                            <div key={l.id} className="p-2 bg-white rounded border border-red-200 flex justify-between items-center text-[11px]">
                              <div>
                                <span className="font-mono font-bold text-blue-700 mr-2">[{l.loop_id}]</span>
                                <span className="font-semibold text-slate-800">{l.name}</span>
                              </div>
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">{l.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {}
                    {deleteUsage.tasks && deleteUsage.tasks.length > 0 && (
                      <div className="space-y-1">
                        <span className="font-bold text-slate-800 block text-[11px] uppercase">Công việc đang thực hiện:</span>
                        <div className="space-y-1 pl-2">
                          {deleteUsage.tasks.map((t: any) => (
                            <div key={t.id} className="p-2 bg-white rounded border border-red-200 flex justify-between items-center text-[11px]">
                              <div>
                                <span className="font-mono font-bold text-blue-700 mr-2">[{t.task_code}]</span>
                                <span className="font-semibold text-slate-800">{t.title}</span>
                              </div>
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]">{t.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {}
                    {deleteUsage.issues && deleteUsage.issues.length > 0 && (
                      <div className="space-y-1">
                        <span className="font-bold text-slate-800 block text-[11px] uppercase">Bất thường / Khiếm khuyết chưa đóng:</span>
                        <div className="space-y-1 pl-2">
                          {deleteUsage.issues.map((i: any) => (
                            <div key={i.id} className="p-2 bg-white rounded border border-red-200 flex justify-between items-center text-[11px]">
                              <div>
                                <span className="font-mono font-bold text-red-700 mr-2">[{i.issue_code}]</span>
                                <span className="font-semibold text-slate-800">{i.title}</span>
                              </div>
                              <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded font-bold text-[10px]">{i.severity} - {i.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {}
                    {deleteUsage.schedules && deleteUsage.schedules.length > 0 && (
                      <div className="space-y-1">
                        <span className="font-bold text-slate-800 block text-[11px] uppercase">Lịch kiểm tra đang kích hoạt:</span>
                        <div className="space-y-1 pl-2">
                          {deleteUsage.schedules.map((s: any) => (
                            <div key={s.id} className="p-2 bg-white rounded border border-red-200 flex justify-between items-center text-[11px]">
                              <div>
                                <span className="font-mono font-bold text-slate-700 mr-2">[{s.schedule_code}]</span>
                                <span className="font-semibold text-slate-800">{s.title}</span>
                              </div>
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">{s.frequency}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-100"
              >
                {deleteUsage ? 'Đã Hiểu & Đóng' : 'Hủy Bỏ'}
              </button>
              {!deleteUsage && (
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? 'Đang xóa...' : 'Xóa Mềm Thiết Bị'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {}
      <DeviceProposalModal
        isOpen={proposalModalOpen}
        onClose={() => setProposalModalOpen(false)}
        onSuccess={() => {
          setSuccess('Đã gửi đề xuất thành công! Cấp quản lý sẽ xem xét và phê duyệt.');
          fetchDevices({ limit: 10 });
        }}
        mode={proposalMode}
        device={proposalTargetDevice}
        substations={substations}
        feeders={feeders}
      />
      {}
      <BulkStatusModal
        isOpen={bulkStatusModalOpen}
        onClose={() => setBulkStatusModalOpen(false)}
        selectedDevices={selectedDevices}
        onSuccess={(msg) => {
          setSuccess(msg);
          fetchDevices({ limit: 10 });
          setSelectedIds([]);
        }}
      />
      {}
      <BulkExportModal
        isOpen={bulkExportModalOpen}
        onClose={() => setBulkExportModalOpen(false)}
        selectedDevices={selectedDevices}
      />
      {}
      {geoCameraDevice && (
        <GeoCameraCaptureModal
          deviceId={geoCameraDevice.id}
          deviceName={geoCameraDevice.name}
          deviceCode={geoCameraDevice.device_id}
          defaultLat={geoCameraDevice.latitude}
          defaultLng={geoCameraDevice.longitude}
          isOpen={geoCameraModalOpen}
          onClose={() => {
            setGeoCameraModalOpen(false);
            setGeoCameraDevice(null);
          }}
          onSuccess={() => {
            setSuccess('Đã chụp và lưu ảnh định vị tọa độ thiết bị thành công!');
            fetchDevices({ limit: 10 });
          }}
        />
      )}
      {}
      {zaloQRDevice && (
        <ZaloQRShareModal
          device={zaloQRDevice}
          isOpen={zaloQRModalOpen}
          onClose={() => {
            setZaloQRModalOpen(false);
            setZaloQRDevice(null);
          }}
        />
      )}
    </div>
  );
};
