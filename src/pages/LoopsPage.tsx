import React, { useState, useEffect } from 'react';
import {
  GitFork,
  Plus,
  Search,
  Filter,
  Eye,
  Trash2,
  Edit2,
  Activity,
  CheckCircle2,
  AlertCircle,
  Building2,
  Zap,
  ArrowRight,
  Layers,
  ChevronRight,
  RefreshCw,
  X,
  Download,
  Upload,
  FileSpreadsheet,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Check,
  ExternalLink,
  MapPin,
  Compass,
  Map,
  Navigation,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Loop, Substation, Feeder, Device } from '../types';
import { api } from '../lib/api';
import { normalizeLoop } from '../lib/loopUtils';
import { useAuth } from '../context/AuthContext';
import { validateTopology, TopologyValidationReport } from '../lib/topologyValidator';
import { TopologyDiagnosticsModal } from '../components/topology/TopologyDiagnosticsModal';
import { useRealtimeSync } from '../lib/realtime';

export const LoopsPage: React.FC = () => {
  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('popstate'));
  };
  const { hasPermission, isGuest, user } = useAuth();
  const isAdmin = user?.roles?.includes('ADMIN') || hasPermission('equipment:delete');

  const [loops, setLoops] = useState<Loop[]>([]);
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [feeders, setFeeders] = useState<Feeder[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [substationFilter, setSubstationFilter] = useState('');

  // Reset All Loops State & Modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState<'STATS' | 'CONFIRM' | 'SUCCESS'>('STATS');
  const [resetStats, setResetStats] = useState<{
    loops: number;
    active_loops: number;
    versions: number;
    nodes: number;
    edges: number;
    change_requests: number;
  } | null>(null);
  const [resetStatsLoading, setResetStatsLoading] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetReport, setResetReport] = useState<any | null>(null);

  // Import Loop Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  // Create / Edit Loop Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoop, setEditingLoop] = useState<Loop | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Loop Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingLoop, setDeletingLoop] = useState<Loop | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<{
    pending_approvals?: any[];
    active_tasks?: any[];
    active_issues?: any[];
    active_schedules?: any[];
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    loop_id: '',
    name: '',
    substation_id_a: '',
    feeder_id_a: '',
    device_id_a: '',
    loop_device_id: '',
    substation_id_b: '',
    feeder_id_b: '',
    device_id_b: '',
    latitude: '',
    longitude: '',
    google_maps_url: '',
    configuration_status: 'ACTIVE',
    operation_status: 'OPEN',
    inspection_cycle: 'MONTHLY',
    status: 'ACTIVE',
    notes: ''
  });

  const [feederListA, setFeederListA] = useState<Feeder[]>([]);
  const [deviceListA, setDeviceListA] = useState<Device[]>([]);
  const [feederListB, setFeederListB] = useState<Feeder[]>([]);
  const [deviceListB, setDeviceListB] = useState<Device[]>([]);

  const handleLoopDeviceChange = (devId: string) => {
    const dev = devices.find(d => String(d.device_id) === String(devId) || String(d.id) === String(devId));
    setFormData(prev => ({
      ...prev,
      loop_device_id: devId,
      latitude: dev?.latitude !== undefined && dev?.latitude !== null ? String(dev.latitude) : prev.latitude,
      longitude: dev?.longitude !== undefined && dev?.longitude !== null ? String(dev.longitude) : prev.longitude,
      google_maps_url: dev?.google_maps_url || prev.google_maps_url,
      operation_status: dev?.switch_status === 'CLOSED' ? 'CLOSED' : 'OPEN'
    }));
  };

  const downloadLoopSampleTemplate = () => {
    const data = [
      [
        "Mã khép vòng",
        "Tên khép vòng",
        "Trạm phía A",
        "Phát tuyến phía A",
        "Thiết bị phía A",
        "Điểm dừng pháp lý",
        "Trạm phía B",
        "Phát tuyến phía B",
        "Thiết bị phía B",
        "Link Google Maps",
        "Trạng thái cấu hình",
        "Trạng thái vận hành",
        "Ghi chú"
      ],
      [
        "KV-110-01",
        "Khép vòng 471 E1.1 - 472 E1.2",
        "Trạm 110kV E1",
        "471-E1",
        "LBS-471-01",
        "LBS-KV-01",
        "Trạm 110kV E2",
        "472-E2",
        "LBS-472-01",
        "https://maps.google.com/?q=10.7769,106.7009",
        "ACTIVE",
        "OPEN",
        "Khép vòng dự phòng liên trạm"
      ]
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "KhepVong");
    XLSX.writeFile(workbook, "Mau_Import_Khep_Vong.xlsx");
  };

  const exportLoopsExcel = () => {
    if (loops.length === 0) {
      alert('Không có dữ liệu khép vòng để xuất.');
      return;
    }
    const exportData = loops.map(l => ({
      "Mã khép vòng": l.loop_id,
      "Tên khép vòng": l.name,
      "Trạm phía A": l.substation_name_a || '',
      "Phát tuyến phía A": l.feeder_code_a || '',
      "Thiết bị phía A": l.device_id_a || '',
      "Điểm dừng pháp lý": l.loop_device_code || l.loop_device_id || '',
      "Trạm phía B": l.substation_name_b || '',
      "Phát tuyến phía B": l.feeder_code_b || '',
      "Thiết bị phía B": l.device_id_b || '',
      "Link Google Maps": l.google_maps_url || '',
      "Trạng thái cấu hình": l.configuration_status || l.config_status || l.status || 'ACTIVE',
      "Trạng thái vận hành": l.operation_status || l.operating_status || 'OPEN',
      "Chu kỳ kiểm tra": l.inspection_cycle || 'MONTHLY',
      "Ghi chú": l.notes || ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "KhepVong");
    XLSX.writeFile(workbook, `Danh_Sach_Khep_Vong_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleLoopFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        
        if (json.length < 2) {
          alert('File không có dữ liệu.');
          return;
        }
        const headers = json[0].map(h => (h || '').toString().trim().toLowerCase());
        const rows: any[] = [];
        for (let i = 1; i < json.length; i++) {
          const r = json[i];
          if (!r || r.every(c => !c)) continue;
          const obj: any = {};
          headers.forEach((h, idx) => {
            const val = r[idx] !== undefined ? r[idx].toString().trim() : '';
            if (h.includes('mã') && h.includes('vòng')) obj.loop_id = val;
            else if (h.includes('tên') && h.includes('vòng')) obj.name = val;
            else if (h.includes('trạm') && (h.includes('a') || h.includes('đầu a'))) obj.station_a = val;
            else if (h.includes('tuyến') && (h.includes('a') || h.includes('đầu a'))) obj.feeder_a = val;
            else if (h.includes('thiết bị') && (h.includes('a') || h.includes('đầu a'))) obj.device_a = val;
            else if (h.includes('chính') || (h.includes('khép') && h.includes('chính'))) obj.loop_device = val;
            else if (h.includes('thiết bị') && (h.includes('b') || h.includes('đầu b'))) obj.device_b = val;
            else if (h.includes('tuyến') && (h.includes('b') || h.includes('đầu b'))) obj.feeder_b = val;
            else if (h.includes('trạm') && (h.includes('b') || h.includes('đầu b'))) obj.station_b = val;
            else if (h.includes('maps') || h.includes('tọa độ') || h.includes('link')) obj.google_maps_url = val;
            else if (h.includes('cấu hình')) obj.configuration_status = val;
            else if (h.includes('vận hành')) obj.operation_status = val;
            else if (h.includes('trạng thái')) obj.status = val;
            else if (h.includes('ghi chú')) obj.notes = val;
          });
          if (obj.loop_id || obj.name) rows.push(obj);
        }
        setImportRows(rows);
        setIsImportModalOpen(true);
      } catch (err: any) {
        alert(`Lỗi đọc file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExecuteLoopImport = async () => {
    if (importRows.length === 0) return;
    try {
      setImporting(true);
      const res = await api.importLoops(importRows);
      if (res.success) {
        alert(res.message || 'Nhập khép vòng thành công!');
        setIsImportModalOpen(false);
        setImportRows([]);
        fetchLoopsData();
      }
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const fetchLoopsData = async () => {
    setLoading(true);
    try {
      const res = await api.getLoops({
        search: searchTerm,
        status: statusFilter,
        substation_id: substationFilter
      });
      if (res.success) {
        setLoops(res.data.map(normalizeLoop));
      }
    } catch (err) {
      console.error('Error fetching loops:', err);
    } finally {
      setLoading(false);
    }
  };

  // Diagnostics Modal State
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);
  const [selectedLoopForDiagnostics, setSelectedLoopForDiagnostics] = useState<Loop | null>(null);
  const [diagnosticsReport, setDiagnosticsReport] = useState<TopologyValidationReport | null>(null);

  const handleOpenDiagnostics = (loop: Loop) => {
    const report = validateTopology({
      loop,
      allDevices: devices,
      allFeeders: feeders,
      allSubstations: substations,
      allLoops: loops
    });
    setSelectedLoopForDiagnostics(loop);
    setDiagnosticsReport(report);
    setIsDiagnosticsModalOpen(true);
  };

  const fetchMasterData = async () => {
    try {
      const [subsRes, devRes, feedRes] = await Promise.all([
        api.getSubstations(),
        api.getDevices({ limit: 500 }),
        api.getFeeders()
      ]);
      if (subsRes.success) setSubstations(subsRes.data);
      if (devRes.success) setDevices(devRes.data);
      if (feedRes.success) setFeeders(feedRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    fetchLoopsData();
  }, [searchTerm, statusFilter, substationFilter]);

  useRealtimeSync(() => {
    fetchLoopsData();
    fetchMasterData();
  });

  // Handle Station A selection change
  const handleSubstationAChange = async (subId: string) => {
    setFormError(null);
    setFormData(prev => ({ ...prev, substation_id_a: subId, feeder_id_a: '', device_id_a: '' }));
    if (subId) {
      const res = await api.getFeeders({ substation_id: subId });
      if (res.success) setFeederListA(res.data.filter((f: any) => f.status !== 'INACTIVE'));
    } else {
      setFeederListA([]);
    }
  };

  const handleFeederAChange = async (feederId: string) => {
    setFormError(null);
    setFormData(prev => ({ ...prev, feeder_id_a: feederId, device_id_a: '' }));
    if (feederId) {
      try {
        const res = await api.getDevices({ feeder_id: feederId, limit: 500 });
        if (res.success) {
          setDeviceListA(res.data.filter((d: any) => d.status !== 'INACTIVE'));
        } else {
          setDeviceListA(devices.filter(d => String(d.feeder_id) === String(feederId) && d.status !== 'INACTIVE'));
        }
      } catch (e) {
        setDeviceListA(devices.filter(d => String(d.feeder_id) === String(feederId) && d.status !== 'INACTIVE'));
      }
    } else {
      setDeviceListA([]);
    }
  };

  // Handle Station B selection change
  const handleSubstationBChange = async (subId: string) => {
    setFormError(null);
    setFormData(prev => ({ ...prev, substation_id_b: subId, feeder_id_b: '', device_id_b: '' }));
    if (subId) {
      const res = await api.getFeeders({ substation_id: subId });
      if (res.success) setFeederListB(res.data.filter((f: any) => f.status !== 'INACTIVE'));
    } else {
      setFeederListB([]);
    }
  };

  const handleFeederBChange = async (feederId: string) => {
    setFormError(null);
    setFormData(prev => ({ ...prev, feeder_id_b: feederId, device_id_b: '' }));
    if (feederId) {
      try {
        const res = await api.getDevices({ feeder_id: feederId, limit: 500 });
        if (res.success) {
          setDeviceListB(res.data.filter((d: any) => d.status !== 'INACTIVE'));
        } else {
          setDeviceListB(devices.filter(d => String(d.feeder_id) === String(feederId) && d.status !== 'INACTIVE'));
        }
      } catch (e) {
        setDeviceListB(devices.filter(d => String(d.feeder_id) === String(feederId) && d.status !== 'INACTIVE'));
      }
    } else {
      setDeviceListB([]);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingLoop(null);
    setFormError(null);
    setFormData({
      loop_id: `KV-110-0${loops.length + 1}`,
      name: '',
      substation_id_a: '',
      feeder_id_a: '',
      device_id_a: '',
      loop_device_id: '',
      substation_id_b: '',
      feeder_id_b: '',
      device_id_b: '',
      latitude: '',
      longitude: '',
      google_maps_url: '',
      configuration_status: 'ACTIVE',
      operation_status: 'OPEN',
      inspection_cycle: 'MONTHLY',
      status: 'ACTIVE',
      notes: ''
    });
    setFeederListA([]);
    setDeviceListA([]);
    setFeederListB([]);
    setDeviceListB([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (loop: Loop) => {
    setEditingLoop(loop);
    setFormError(null);
    setFormData({
      loop_id: loop.loop_id,
      name: loop.name,
      substation_id_a: String(loop.substation_id_a || ''),
      feeder_id_a: String(loop.feeder_id_a || ''),
      device_id_a: String(loop.device_id_a || ''),
      loop_device_id: String(loop.loop_device_id || ''),
      substation_id_b: String(loop.substation_id_b || ''),
      feeder_id_b: String(loop.feeder_id_b || ''),
      device_id_b: String(loop.device_id_b || ''),
      latitude: loop.latitude !== undefined && loop.latitude !== null ? String(loop.latitude) : '',
      longitude: loop.longitude !== undefined && loop.longitude !== null ? String(loop.longitude) : '',
      google_maps_url: loop.google_maps_url || '',
      configuration_status: loop.configuration_status || loop.config_status || loop.status || 'ACTIVE',
      operation_status: loop.operation_status || loop.operating_status || 'OPEN',
      inspection_cycle: loop.inspection_cycle || 'MONTHLY',
      status: loop.status || 'ACTIVE',
      notes: loop.notes || ''
    });

    if (loop.substation_id_a) {
      const res = await api.getFeeders({ substation_id: String(loop.substation_id_a) });
      if (res.success) setFeederListA(res.data.filter((f: any) => f.status !== 'INACTIVE'));
    }
    if (loop.feeder_id_a) {
      const res = await api.getDevices({ feeder_id: String(loop.feeder_id_a), limit: 500 });
      if (res.success) setDeviceListA(res.data.filter((d: any) => d.status !== 'INACTIVE'));
    }
    if (loop.substation_id_b) {
      const res = await api.getFeeders({ substation_id: String(loop.substation_id_b) });
      if (res.success) setFeederListB(res.data.filter((f: any) => f.status !== 'INACTIVE'));
    }
    if (loop.feeder_id_b) {
      const res = await api.getDevices({ feeder_id: String(loop.feeder_id_b), limit: 500 });
      if (res.success) setDeviceListB(res.data.filter((d: any) => d.status !== 'INACTIVE'));
    }

    setIsModalOpen(true);
  };

  const handleSaveLoop = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation 1: Required fields
    if (
      !formData.loop_id ||
      !formData.name ||
      !formData.substation_id_a ||
      !formData.feeder_id_a ||
      !formData.device_id_a ||
      !formData.substation_id_b ||
      !formData.feeder_id_b ||
      !formData.device_id_b
    ) {
      setFormError('Vui lòng điền đầy đủ tất cả các trường thông tin bắt buộc.');
      return;
    }

    // Validation 2: Endpoint feeder uniqueness
    if (String(formData.feeder_id_a) === String(formData.feeder_id_b)) {
      setFormError('Phát tuyến đầu A và phát tuyến đầu B không được giống nhau. Khép vòng phải được tạo giữa 2 phát tuyến khác nhau.');
      return;
    }

    // Validation 3: Endpoint device uniqueness
    if (String(formData.device_id_a).trim() === String(formData.device_id_b).trim()) {
      setFormError('Thiết bị điểm đầu A và điểm đầu B không được giống nhau.');
      return;
    }

    try {
      if (editingLoop) {
        const res = await api.updateLoop(editingLoop.id, { ...formData, schemaVersion: editingLoop.schemaVersion || 1 });
        if (res.success) {
          setIsModalOpen(false);
          fetchLoopsData();
        }
      } else {
        const res = await api.createLoop({ ...formData, schemaVersion: 1 });
        if (res.success) {
          setIsModalOpen(false);
          fetchLoopsData();
          navigate(`/loops/${res.loopId}`);
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Thao tác lưu khép vòng thất bại.');
    }
  };

  const handleOpenDeleteModal = (loop: Loop) => {
    if (isGuest()) return;
    setDeletingLoop(loop);
    setDeleteError(null);
    setDeleteUsage(null);
    setIsDeleting(false);
    setDeleteModalOpen(true);
  };

  const handleConfirmDeleteLoop = async () => {
    if (!deletingLoop) return;
    setIsDeleting(true);
    setDeleteError(null);
    setDeleteUsage(null);

    try {
      const res = await api.deleteLoop(deletingLoop.id);
      if (res.success) {
        setDeleteModalOpen(false);
        setDeletingLoop(null);
        fetchLoopsData();
      }
    } catch (err: any) {
      const usage = err.usage || err.data?.usage;
      if (err.status === 409 || usage) {
        setDeleteError(err.data?.message || err.message || 'Không thể xóa khép vòng vì đang có dữ liệu liên quan.');
        setDeleteUsage(usage || {});
      } else if (err.status === 403) {
        setDeleteError(err.message || 'Bạn không có quyền xóa khép vòng này. (Cần quyền: equipment:delete)');
      } else {
        setDeleteError(err.message || 'Xóa khép vòng thất bại');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // RESET ALL LOOPS HANDLERS
  const handleOpenResetAllModal = async () => {
    setIsResetModalOpen(true);
    setResetStep('STATS');
    setResetConfirmationText('');
    setResetError(null);
    setResetReport(null);
    setResetStatsLoading(true);

    try {
      const res = await api.getLoopResetStats();
      if (res.success) {
        setResetStats(res.counts);
      }
    } catch (e) {
      setResetStats({
        loops: loops.length,
        active_loops: loops.length,
        versions: 0,
        nodes: 0,
        edges: 0,
        change_requests: 0
      });
    } finally {
      setResetStatsLoading(false);
    }
  };

  const handleExecuteResetLoops = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = resetConfirmationText.trim().toUpperCase();
    if (cleanInput !== 'XÓA KHÉP VÒNG' && cleanInput !== 'XOA KHEP VONG' && cleanInput !== 'XÓA TOÀN BỘ KHÉP VÒNG') {
      setResetError('Vui lòng nhập chính xác cụm từ: "XÓA KHÉP VÒNG" để xác nhận.');
      return;
    }

    setIsResetting(true);
    setResetError(null);

    try {
      const res = await api.resetAllLoops(resetConfirmationText.trim());
      if (res.success) {
        setResetReport(res.deleted_count);
        setResetStep('SUCCESS');
        setLoops([]);
      } else {
        setResetError(res.message || 'Xóa toàn bộ khép vòng thất bại.');
      }
    } catch (err: any) {
      setResetError(err.message || 'Lỗi kết nối máy chủ khi thực hiện Reset.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleFinishReset = () => {
    setIsResetModalOpen(false);
    fetchLoopsData();
  };

  return (
    <div className="space-y-6">
      {/* Top Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
        <div>
          <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
            <GitFork className="w-4 h-4" /> Quản Lý Khép Vòng
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">Danh Sách Mạch Khép Vòng (Loop Management)</h1>
          <p className="text-xs text-slate-400 mt-1">
            Quản lý liên kết điểm Trạm 110kV A - Phát tuyến A - Thiết bị A và Trạm 110kV B - Phát tuyến B - Thiết bị B
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Reset All Loops Button for Admin */}
          {!isGuest() && (hasPermission('equipment:delete') || user?.roles?.includes('ADMIN')) && (
            <button
              onClick={handleOpenResetAllModal}
              className="flex items-center space-x-1.5 px-3 py-2 bg-red-950/80 hover:bg-red-900 text-red-300 hover:text-white border border-red-800/80 font-bold rounded-xl text-xs transition-colors shadow-sm"
              title="Xóa toàn bộ dữ liệu Khép vòng để xây dựng lại từ đầu"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Xóa Toàn Bộ Khép Vòng</span>
            </button>
          )}

          <button
            onClick={downloadLoopSampleTemplate}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors"
            title="Tải file mẫu Excel Khép Vòng"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Tải Mẫu</span>
          </button>

          <button
            onClick={exportLoopsExcel}
            className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors"
            title="Xuất Excel danh sách Khép Vòng"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất Excel</span>
          </button>

          {!isGuest() && (
            <label className="flex items-center space-x-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer" title="Nhập dữ liệu Khép Vòng từ Excel">
              <Upload className="w-3.5 h-3.5" />
              <span>Nhập File</span>
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleLoopFileSelect} className="hidden" />
            </label>
          )}

          {!isGuest() && (hasPermission('equipment:create') || hasPermission('MANAGE_LOOPS')) && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo Mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Loop Import Preview Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-400" />
                Xác Nhận Nhập Khép Vòng ({importRows.length} dòng)
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 uppercase font-bold text-slate-400">
                  <tr>
                    <th className="p-2">STT</th>
                    <th className="p-2">Mã KV</th>
                    <th className="p-2">Tên Khép Vòng</th>
                    <th className="p-2">Trạm A</th>
                    <th className="p-2">Tuyến A</th>
                    <th className="p-2">TB A</th>
                    <th className="p-2">TB B</th>
                    <th className="p-2">Tuyến B</th>
                    <th className="p-2">Trạm B</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {importRows.map((r, idx) => (
                    <tr key={idx}>
                      <td className="p-2 text-slate-500">{idx + 1}</td>
                      <td className="p-2 font-mono text-blue-400">{r.loop_id}</td>
                      <td className="p-2">{r.name}</td>
                      <td className="p-2">{r.station_a}</td>
                      <td className="p-2">{r.feeder_a}</td>
                      <td className="p-2 font-mono">{r.device_a}</td>
                      <td className="p-2 font-mono">{r.device_b}</td>
                      <td className="p-2">{r.feeder_b}</td>
                      <td className="p-2">{r.station_b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                Hủy
              </button>
              <button
                onClick={handleExecuteLoopImport}
                disabled={importing}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs shadow-lg flex items-center gap-2"
              >
                {importing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Xác Nhận Import Khép Vòng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Tìm theo Mã ID, Tên khép vòng..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động (ACTIVE)</option>
            <option value="CLOSED">Đang khép vòng (CLOSED)</option>
            <option value="INACTIVE">Ngừng vận hành (INACTIVE)</option>
          </select>
        </div>

        <div>
          <select
            value={substationFilter}
            onChange={e => setSubstationFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Tất cả Trạm 110kV</option>
            {substations.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.substation_code})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchLoopsData}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Loops List Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-xs">Đang tải danh sách Khép vòng...</div>
      ) : loops.length === 0 ? (
        <div className="bg-slate-900/40 rounded-2xl p-12 text-center border border-slate-800 text-slate-500">
          <GitFork className="w-12 h-12 mx-auto mb-3 text-slate-700" />
          <p className="font-bold text-slate-400 text-sm">Chưa có mạch Khép vòng nào được định nghĩa</p>
          <p className="text-xs text-slate-600 mt-1">Bấm "Tạo Khép Vòng Mới" để bắt đầu xây dựng Topology.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {loops.map(loop => {
            const opStatus = loop.operation_status || loop.operating_status || (loop.status === 'CLOSED' ? 'CLOSED' : 'OPEN');
            const cfgStatus = loop.configuration_status || loop.config_status || (loop.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');

            return (
              <div
                key={loop.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl transition-all flex flex-col justify-between space-y-4 group"
              >
                <div>
                  {/* Header Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono font-black text-xs rounded-lg">
                        {loop.loop_id}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        Phiên bản active: <strong className="text-white">v{loop.active_version || '1.0'}</strong>
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {/* Topology Diagnostics Badge */}
                      {(() => {
                        const report = validateTopology({
                          loop,
                          allDevices: devices,
                          allFeeders: feeders,
                          allSubstations: substations,
                          allLoops: loops
                        });
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDiagnostics(loop);
                            }}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                              report.isValid
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 animate-pulse'
                            }`}
                            title="Bấm để kiểm tra chi tiết cấu trúc Topology 7 nút"
                          >
                            {report.isValid ? (
                              <>
                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                <span>🟢 Hợp lệ</span>
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="w-3 h-3 text-rose-400" />
                                <span>🔴 Lỗi ({report.errorCount})</span>
                              </>
                            )}
                          </button>
                        );
                      })()}

                      {/* Operation Status Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          opStatus === 'CLOSED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {opStatus === 'CLOSED' ? '🟢 Khép Vòng' : '🟡 Mở Vòng'}
                      </span>

                      {/* Config Status Badge */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          cfgStatus === 'ACTIVE'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {cfgStatus}
                      </span>
                    </div>
                  </div>

                  {/* Name */}
                  <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors mb-3">
                    {loop.name}
                  </h3>

                  {/* Main Loop Device Banner & Location Details (ĐIỂM DỪNG PHÁP LÝ NỔI BẬT) */}
                  {(loop.loop_device_id || loop.loop_device_code) ? (
                    <div className="mb-3 p-3 bg-gradient-to-r from-amber-950/40 via-purple-950/40 to-slate-900 border-2 border-amber-400/60 rounded-xl space-y-2 text-xs shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-400/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                          <span className="text-amber-300 text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-300" />
                            ĐIỂM DỪNG PHÁP LÝ:
                          </span>
                          <span className="font-extrabold text-white font-mono bg-slate-950/80 px-2 py-0.5 rounded border border-amber-400/40">
                            {loop.loop_device_code || loop.loop_device_name || loop.loop_device_id}
                          </span>
                          {loop.loop_device_type && (
                            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-200 text-[10px] font-bold rounded border border-purple-400/40">
                              {loop.loop_device_type}
                            </span>
                          )}
                        </div>
                        {(() => {
                          const sw = loop.loop_device_switch_status || (loop.operation_status === 'CLOSED' ? 'CLOSED' : 'OPEN');
                          return (
                            <span
                              className={`px-2.5 py-0.5 rounded text-[10px] font-black ${
                                sw === 'CLOSED'
                                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                                  : 'bg-rose-500 text-white shadow-xs'
                              }`}
                            >
                              {sw === 'CLOSED' ? 'ĐÓNG (Closed)' : 'MỞ (Open)'}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Location Information of Main Device */}
                      <div className="pt-2 border-t border-blue-900/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        {/* Pole / Team info */}
                        <div className="flex items-center space-x-1.5 text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>
                            Vị trí trụ:{' '}
                            <strong className="text-white font-mono">
                              {loop.loop_device_pole || 'Chưa cập nhật'}
                            </strong>
                          </span>
                        </div>

                        {/* Team / Unit info */}
                        <div className="flex items-center space-x-1.5 text-slate-300 truncate">
                          <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">
                            Đội QLVH:{' '}
                            <strong className="text-white">
                              {loop.loop_device_team || loop.loop_device_unit || 'Đội Vận Hành'}
                            </strong>
                          </span>
                        </div>

                        {/* GPS Coordinates */}
                        <div className="flex items-center space-x-1.5 text-slate-400 font-mono text-[10px]">
                          <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>
                            Tọa độ:{' '}
                            <span className="text-slate-200">
                              {(loop.latitude || loop.loop_device_latitude) && (loop.longitude || loop.loop_device_longitude)
                                ? `${Number(loop.latitude || loop.loop_device_latitude).toFixed(5)}, ${Number(loop.longitude || loop.loop_device_longitude).toFixed(5)}`
                                : 'Chưa có tọa độ GPS'}
                            </span>
                          </span>
                        </div>

                        {/* Map Link */}
                        <div className="flex items-center justify-start sm:justify-end">
                          {(loop.google_maps_url || loop.loop_device_maps_url) ? (
                            <a
                              href={loop.google_maps_url || loop.loop_device_maps_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center space-x-1 px-2 py-0.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded font-semibold text-[10px] transition-colors"
                            >
                              <Map className="w-3 h-3" />
                              <span>Vị trí trên bản đồ</span>
                              <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">Chưa có link GIS</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3 p-2.5 bg-slate-950/60 border border-dashed border-slate-800 rounded-xl text-slate-400 text-xs flex items-center justify-between">
                      <span className="italic text-[11px]">Chưa chỉ định Điểm dừng pháp lý</span>
                      <button
                        onClick={() => handleOpenEditModal(loop)}
                        className="text-blue-400 hover:text-blue-300 font-semibold text-[11px]"
                      >
                        + Chọn thiết bị
                      </button>
                    </div>
                  )}

                  {/* Linking Endpoints Box: A <-> Main Device <-> B */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                    {/* Point A */}
                    <div className="space-y-1 border-r border-slate-800/80 pr-2">
                      <div className="text-[10px] uppercase font-bold text-slate-500">ĐẦU A (Nguồn A)</div>
                      <div className="font-bold text-slate-200 truncate">{loop.substation_name_a || 'Trạm A'}</div>
                      <div className="text-[11px] text-blue-400">{loop.feeder_code_a || 'Phát tuyến A'}</div>
                      <div className="text-[10px] font-mono text-slate-400">TB A: {loop.device_id_a}</div>
                    </div>

                    {/* Point B */}
                    <div className="space-y-1 pl-2">
                      <div className="text-[10px] uppercase font-bold text-slate-500">ĐẦU B (Nguồn B)</div>
                      <div className="font-bold text-slate-200 truncate">{loop.substation_name_b || 'Trạm B'}</div>
                      <div className="text-[11px] text-purple-400">{loop.feeder_code_b || 'Phát tuyến B'}</div>
                      <div className="text-[10px] font-mono text-slate-400">TB B: {loop.device_id_b}</div>
                    </div>
                  </div>

                  {/* Map link and inspection cycle if available */}
                  {(loop.google_maps_url || loop.inspection_cycle) && (
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 px-1">
                      {loop.inspection_cycle && (
                        <span>
                          Chu kỳ kiểm tra:{' '}
                          <strong className="text-slate-300">
                            {loop.inspection_cycle === 'MONTHLY'
                              ? 'Hàng tháng'
                              : loop.inspection_cycle === 'QUARTERLY'
                              ? 'Hàng quý'
                              : 'Hàng năm'}
                          </strong>
                        </span>
                      )}
                      {loop.google_maps_url && (
                        <a
                          href={loop.google_maps_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-400 hover:text-sky-300 font-medium inline-flex items-center space-x-1"
                        >
                          <span>Xem bản đồ GIS</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3 text-slate-400 text-[11px]">
                    <span>
                      Nodes: <strong className="text-white">{loop.node_count || 0}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Edges: <strong className="text-white">{loop.edge_count || 0}</strong>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => navigate(`/loops/${loop.id}`)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 font-bold rounded-xl transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Chi Tiết & Topology</span>
                    </button>

                    {!isGuest() && (
                      <button
                        onClick={() => handleOpenEditModal(loop)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Chỉnh sửa thông tin khép vòng"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}

                    {!isGuest() && (hasPermission('equipment:delete') || hasPermission('MANAGE_LOOPS')) && (
                      <button
                        onClick={() => handleOpenDeleteModal(loop)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title="Xóa khép vòng"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT LOOP MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-blue-400">
                <GitFork className="w-5 h-5" />
                <h3 className="font-bold text-white text-sm">
                  {editingLoop ? 'Chỉnh Sửa Thông Tin Khép Vòng' : 'Tạo Mới Khép Vòng Lưới Điện'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLoop} className="p-6 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-200 flex items-start space-x-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">{formError}</div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Mã Khép Vòng (Loop ID) *</label>
                  <input
                    type="text"
                    required
                    value={formData.loop_id}
                    onChange={e => setFormData({ ...formData, loop_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    placeholder="VD: KV-110-01"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Tên Khép Vòng *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    placeholder="VD: Khép vòng 471 E1.1 - 471 E1.2"
                  />
                </div>
              </div>

              {/* MAIN LOOP DEVICE (PHYSICAL EQUIPMENT) */}
              <div className="p-4 bg-slate-950 rounded-xl border border-blue-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sky-400 text-xs uppercase tracking-wider">
                    ĐIỂM DỪNG PHÁP LÝ (VẬT LÝ)
                  </h4>
                  <span className="text-[10px] text-slate-400">Thiết bị đóng/cắt liên kết giữa 2 xuất tuyến</span>
                </div>
                <div>
                  <label className="block font-medium text-slate-400 mb-1">Chọn Điểm Dừng Pháp Lý</label>
                  <select
                    value={formData.loop_device_id}
                    onChange={e => handleLoopDeviceChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="">-- Chọn Điểm dừng pháp lý (LBS, Recloser, DS...) --</option>
                    {devices.map(d => (
                      <option key={d.id} value={d.device_id}>
                        {d.device_id} - {d.name} ({d.device_type}) {d.feeder_name ? `[${d.feeder_name}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ENDPOINT A BOX */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-blue-400 text-xs uppercase tracking-wider">THÔNG TIN ĐẦU A (Nguồn A)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-400 mb-1">Trạm 110kV A *</label>
                    <select
                      required
                      value={formData.substation_id_a}
                      onChange={e => handleSubstationAChange(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="">-- Chọn Trạm A --</option>
                      {substations.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-400 mb-1">Phát tuyến A *</label>
                    <select
                      required
                      value={formData.feeder_id_a}
                      onChange={e => handleFeederAChange(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="">-- Chọn Phát tuyến A --</option>
                      {feederListA.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.feeder_code} - {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-400 mb-1">Thiết bị đầu A *</label>
                    <select
                      required
                      value={formData.device_id_a}
                      onChange={e => setFormData({ ...formData, device_id_a: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="">-- Chọn Thiết bị --</option>
                      {deviceListA.map(d => (
                        <option key={d.id} value={d.device_id}>
                          {d.device_id} - {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ENDPOINT B BOX */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-purple-400 text-xs uppercase tracking-wider">THÔNG TIN ĐẦU B (Nguồn B)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-400 mb-1">Trạm 110kV B *</label>
                    <select
                      required
                      value={formData.substation_id_b}
                      onChange={e => handleSubstationBChange(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="">-- Chọn Trạm B --</option>
                      {substations.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-400 mb-1">Phát tuyến B *</label>
                    <select
                      required
                      value={formData.feeder_id_b}
                      onChange={e => handleFeederBChange(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="">-- Chọn Phát tuyến B --</option>
                      {feederListB.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.feeder_code} - {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-400 mb-1">Thiết bị đầu B *</label>
                    <select
                      required
                      value={formData.device_id_b}
                      onChange={e => setFormData({ ...formData, device_id_b: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="">-- Chọn Thiết bị --</option>
                      {deviceListB.map(d => (
                        <option key={d.id} value={d.device_id}>
                          {d.device_id} - {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* LOCATION & STATUS ROW */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Trạng thái cấu hình</label>
                  <select
                    value={formData.configuration_status}
                    onChange={e => setFormData({ ...formData, configuration_status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                    <option value="INACTIVE">Vô hiệu hóa (INACTIVE)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Trạng thái vận hành</label>
                  <select
                    value={formData.operation_status}
                    onChange={e => setFormData({ ...formData, operation_status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="OPEN">Đang mở vòng (OPEN)</option>
                    <option value="CLOSED">Đang khép vòng (CLOSED)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Chu kỳ kiểm tra</label>
                  <select
                    value={formData.inspection_cycle}
                    onChange={e => setFormData({ ...formData, inspection_cycle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="MONTHLY">Hàng tháng (1 tháng)</option>
                    <option value="QUARTERLY">Hàng quý (3 tháng)</option>
                    <option value="YEARLY">Hàng năm (12 tháng)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-400 mb-1">Vĩ độ (Latitude)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="VD: 10.7769"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-400 mb-1">Kinh độ (Longitude)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="VD: 106.7009"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-400 mb-1">Link Google Maps</label>
                  <input
                    type="text"
                    value={formData.google_maps_url}
                    onChange={e => setFormData({ ...formData, google_maps_url: e.target.value })}
                    placeholder="https://maps.google.com/..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Ghi chú</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Nhập phương thức vận hành hoặc ghi chú kỹ thuật..."
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg"
                >
                  {editingLoop ? 'Lưu Thay Đổi' : 'Khởi Tạo Khép Vòng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION & CONFLICT MODAL */}
      {deleteModalOpen && deletingLoop && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 text-red-400">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-white text-sm">Xác Nhận Xóa Mạch Khép Vòng Lưới Điện</h3>
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
              {/* Loop Summary Box */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-400 font-mono font-bold rounded text-[11px]">
                    {deletingLoop.loop_id}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Trạng thái: <strong className="text-emerald-400">{deletingLoop.status}</strong>
                  </span>
                </div>
                <h4 className="font-bold text-white text-sm">{deletingLoop.name}</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                  <div>
                    <span className="text-slate-500 font-semibold block">ĐẦU NGUỒN A:</span>
                    <div className="font-bold text-white">
                      {deletingLoop.substation_name_a || 'Trạm A'} - {deletingLoop.feeder_code_a || 'Phát tuyến A'}
                    </div>
                    <div className="text-slate-400">Thiết bị: {deletingLoop.device_id_a}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block">ĐẦU NGUỒN B:</span>
                    <div className="font-bold text-white">
                      {deletingLoop.substation_name_b || 'Trạm B'} - {deletingLoop.feeder_code_b || 'Phát tuyến B'}
                    </div>
                    <div className="text-slate-400">Thiết bị: {deletingLoop.device_id_b}</div>
                  </div>
                </div>
              </div>

              {/* Notice Box about Soft Delete */}
              {!deleteError && (
                <div className="p-3 bg-blue-950/40 border border-blue-800/50 rounded-xl text-blue-300 flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed text-[11px]">
                    <strong>Quy trình XÓA MỀM (Soft Delete):</strong> Mạch khép vòng sẽ chuyển sang trạng thái đã xóa và bị ẩn khỏi danh sách vận hành.
                    <br />
                    <span className="text-blue-200/80">
                      • Danh mục Thiết bị lưới điện (LBS, DS, Recloser...) <strong>KHÔNG bị xóa</strong>.
                      <br />
                      • Toàn bộ lịch sử sơ đồ Topology và nhật ký phê duyệt được lưu trữ an toàn.
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
                      {/* Pending Approvals */}
                      {deleteUsage.pending_approvals && deleteUsage.pending_approvals.length > 0 && (
                        <div>
                          <strong className="text-amber-400 font-bold block mb-1">
                            • Yêu cầu phê duyệt Sơ đồ đang chờ xử lý ({deleteUsage.pending_approvals.length}):
                          </strong>
                          <div className="bg-slate-950/80 p-2 rounded-lg border border-red-900/40 space-y-1">
                            {deleteUsage.pending_approvals.map((app: any) => (
                              <div key={app.id} className="flex justify-between text-slate-300">
                                <span>Phiên bản v{app.version_str} - Người gửi: {app.requester_fullname}</span>
                                <span className="text-amber-400 font-bold">{app.status}</span>
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
                  onClick={handleConfirmDeleteLoop}
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

      {/* RESET ALL LOOPS MODAL (2-Step Confirmation) */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* STEP 1: STATS & PRE-CHECK */}
            {resetStep === 'STATS' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-950/80 border border-red-800 text-red-400 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-base">Xóa Toàn Bộ Dữ Liệu Khép Vòng</h3>
                      <p className="text-xs text-red-400 font-medium">Bước 1/2: Kiểm kê số lượng dữ liệu Khép vòng sắp xóa</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsResetModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {resetStatsLoading ? (
                  <div className="py-10 text-center text-slate-400 flex items-center justify-center space-x-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                    <span>Đang kiểm tra dữ liệu hệ thống...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                        <p className="text-slate-400 text-[11px]">Mạch Khép Vòng</p>
                        <p className="text-lg font-black text-white mt-1">{resetStats?.loops || 0}</p>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                        <p className="text-slate-400 text-[11px]">Phiên Bản Topology</p>
                        <p className="text-lg font-black text-white mt-1">{resetStats?.versions || 0}</p>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                        <p className="text-slate-400 text-[11px]">Nodes / Edges</p>
                        <p className="text-lg font-black text-white mt-1">
                          {(resetStats?.nodes || 0) + (resetStats?.edges || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3.5 space-y-1.5 text-xs text-emerald-300">
                      <div className="flex items-center space-x-2 font-bold text-emerald-200">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Dữ liệu hạ tầng được BẢO TOÀN NGUYÊN VẸN:</span>
                      </div>
                      <p className="text-emerald-400/90 text-[11px] leading-relaxed pl-6">
                        • Toàn bộ Trạm 110kV, Phát tuyến, Thiết bị (Recloser, LBS, RMU, DS), Tọa độ bản đồ GIS và Tài khoản nhân sự <strong>KHÔNG BỊ XÓA</strong>.
                      </p>
                    </div>

                    <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-3.5 text-xs text-red-300 space-y-1">
                      <p className="font-bold text-red-200">Phạm vi sẽ bị xóa sạch:</p>
                      <p className="text-red-400 text-[11px] leading-relaxed">
                        • Tất cả định nghĩa Khép vòng, cấu hình liên kết Đầu A / Đầu B, các liên kết topology và yêu cầu phê duyệt khép vòng.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="button"
                    disabled={resetStatsLoading}
                    onClick={() => setResetStep('CONFIRM')}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-red-600/30 flex items-center space-x-2 disabled:opacity-50"
                  >
                    <span>Tiếp Tục: Xác Nhận Xóa</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: VERIFICATION & EXECUTION */}
            {resetStep === 'CONFIRM' && (
              <form onSubmit={handleExecuteResetLoops} className="p-6 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center font-bold">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-base">Xác Nhận Thực Hiện Reset</h3>
                      <p className="text-xs text-red-400 font-medium">Bước 2/2: Nhập chuỗi bảo mật để tiến hành</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-red-950/60 border border-red-800 rounded-xl p-4 text-xs text-red-200 space-y-2">
                  <p className="font-bold text-red-100 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    CẢNH BÁO NGUY HIỂM:
                  </p>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Hệ thống sẽ thực hiện xóa toàn bộ mạch Khép vòng trong một Giao dịch CSDL (Transaction) an toàn. Sau khi xóa, bạn có thể tạo mới hoặc nhập lại Khép vòng từ đầu.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    Để xác nhận, vui lòng nhập chính xác cụm từ <span className="text-red-400 font-mono font-black">XÓA KHÉP VÒNG</span> vào ô bên dưới:
                  </label>
                  <input
                    type="text"
                    required
                    value={resetConfirmationText}
                    onChange={e => {
                      setResetConfirmationText(e.target.value);
                      setResetError(null);
                    }}
                    placeholder="Nhập: XÓA KHÉP VÒNG"
                    className="w-full bg-slate-950 border-2 border-red-800/80 focus:border-red-500 rounded-xl px-4 py-2.5 text-white font-mono font-bold text-sm tracking-wider placeholder-slate-600 focus:outline-none"
                    autoFocus
                  />
                  {resetError && (
                    <p className="text-xs font-semibold text-red-400 flex items-center space-x-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{resetError}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setResetStep('STATS')}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
                  >
                    Quay Lại
                  </button>

                  <button
                    type="submit"
                    disabled={
                      isResetting ||
                      resetConfirmationText.trim().toUpperCase() !== 'XÓA KHÉP VÒNG' &&
                      resetConfirmationText.trim().toUpperCase() !== 'XOA KHEP VONG'
                    }
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-red-600/30 flex items-center space-x-2 disabled:cursor-not-allowed"
                  >
                    {isResetting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang thực hiện Transaction...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>XÁC NHẬN XÓA TOÀN BỘ KHÉP VÒNG</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: SUCCESS REPORT */}
            {resetStep === 'SUCCESS' && (
              <div className="p-6 space-y-6 text-center">
                <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="font-extrabold text-white text-lg">Đã Xóa Toàn Bộ Dữ Liệu Khép Vòng!</h3>
                  <p className="text-xs text-slate-400">
                    Cơ sở dữ liệu Khép vòng đã được làm sạch hoàn toàn. Trạm 110kV, Phát tuyến và Thiết bị được giữ nguyên.
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-left">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Khép vòng đã xóa</span>
                    <span className="text-red-400 font-mono font-bold text-sm">
                      {resetReport?.loops ?? resetStats?.loops ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Phiên bản đã xóa</span>
                    <span className="text-red-400 font-mono font-bold text-sm">
                      {resetReport?.versions ?? resetStats?.versions ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Nodes / Edges</span>
                    <span className="text-red-400 font-mono font-bold text-sm">
                      {(resetReport?.nodes || 0) + (resetReport?.edges || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Trạng thái CSDL</span>
                    <span className="text-emerald-400 font-mono font-bold text-sm">SẠCH (0)</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleFinishReset}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Hoàn Tất & Bắt Đầu Xây Dựng Khép Vòng Mới</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOPOLOGY DIAGNOSTICS & VALIDATION REPORT MODAL */}
      <TopologyDiagnosticsModal
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setIsDiagnosticsModalOpen(false)}
        report={diagnosticsReport}
        loopName={selectedLoopForDiagnostics?.name}
        loopCode={selectedLoopForDiagnostics?.loop_id}
        onEditLoop={selectedLoopForDiagnostics ? () => {
          setIsDiagnosticsModalOpen(false);
          handleOpenEditModal(selectedLoopForDiagnostics);
        } : undefined}
      />
    </div>
  );
};
