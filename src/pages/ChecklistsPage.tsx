import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  CheckSquare,
  Plus,
  Search,
  Copy,
  Edit2,
  Trash2,
  Calendar,
  Zap,
  Play,
  FileCheck,
  RefreshCw,
  Clock,
  Layers,
  ChevronRight,
  ListPlus,
  AlertTriangle,
  RotateCcw,
  Printer,
  Eye,
  BookOpen,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Sparkles,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { api } from '../lib/api';
import { Checklist, InspectionSchedule, Device, InspectionFrequency, ChecklistItem } from '../types';
import { formatDateTime, formatDate } from '../utils/dateTime';

export const ChecklistsPage: React.FC = () => {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'templates' | 'schedules'>('templates');

  // Checklists State
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loadingChecklists, setLoadingChecklists] = useState(true);
  const [checklistSearch, setChecklistSearch] = useState('');
  const [filterDeviceType, setFilterDeviceType] = useState<string>('ALL');
  const [syncingTemplates, setSyncingTemplates] = useState(false);

  // Schedules State
  const [schedules, setSchedules] = useState<InspectionSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletingSchedule, setDeletingSchedule] = useState<InspectionSchedule | null>(null);

  // Modals
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);
  const [previewChecklist, setPreviewChecklist] = useState<Checklist | null>(null);
  const [previewItems, setPreviewItems] = useState<ChecklistItem[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Ref Data
  const [devices, setDevices] = useState<Device[]>([]);
  const [presets, setPresets] = useState<any[]>([]);

  // Checklist Form
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('Kiểm tra định kỳ');
  const [formDeviceType, setFormDeviceType] = useState('REC');
  const [formVersion, setFormVersion] = useState('2026.1');
  const [formDesc, setFormDesc] = useState('');
  const [formItems, setFormItems] = useState<Array<{ content: string; std: string; unit: string; type: string }>>([
    { content: 'Kiểm tra ngoại quan vỏ và hệ thống tiếp địa', std: 'Sạch sẽ, tiếp địa chắc chắn', unit: '-', type: 'PASS_FAIL' }
  ]);

  // Schedule Form
  const [schTitle, setSchTitle] = useState('');
  const [schFrequency, setSchFrequency] = useState<InspectionFrequency>('MONTHLY');
  const [schDeviceId, setSchDeviceId] = useState<string>('');
  const [schChecklistId, setSchChecklistId] = useState<string>('');
  const [schTeam, setSchTeam] = useState('ĐỘI VẬN HÀNH LƯỚI ĐIỆN');
  const [schNextDate, setSchNextDate] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadChecklists();
    loadSchedules();
    loadDevices();
    loadPresets();
  }, []);

  const loadChecklists = async () => {
    setLoadingChecklists(true);
    try {
      const res = await api.getChecklists({
        search: checklistSearch || undefined,
        target_device_type: filterDeviceType !== 'ALL' ? filterDeviceType : undefined
      });
      if (res.success) setChecklists(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingChecklists(false);
    }
  };

  const loadPresets = async () => {
    try {
      const res = await api.getChecklistPresets();
      if (res.success) setPresets(res.data);
    } catch (e) {
      console.error('Error loading presets:', e);
    }
  };

  const loadSchedules = async () => {
    setLoadingSchedules(true);
    try {
      const res = await api.getSchedules();
      if (res.success) setSchedules(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const loadDevices = async () => {
    try {
      const res = await api.getDevices();
      if (res.success) setDevices(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSyncEVNStandards = async () => {
    setSyncingTemplates(true);
    try {
      const res = await api.syncEvnChecklists();
      if (res.success) {
        alert('Đã đồng bộ và cập nhật thành công toàn bộ Mẫu Biên bản Kiểm tra Tiêu chuẩn EVN!');
        await loadChecklists();
        await loadPresets();
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi khi đồng bộ mẫu tiêu chuẩn');
    } finally {
      setSyncingTemplates(false);
    }
  };

  const handleOpenPreview = async (checklist: Checklist) => {
    setPreviewChecklist(checklist);
    setLoadingPreview(true);
    try {
      const res = await api.getChecklist(checklist.id);
      if (res.success) {
        setPreviewChecklist(res.data);
        setPreviewItems(res.data.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleApplyPreset = (preset: any) => {
    setFormTitle(preset.title);
    setFormCategory(preset.category || 'Kiểm tra định kỳ');
    setFormDeviceType(preset.target_device_type || 'REC');
    setFormVersion(preset.version || '2026.1');
    setFormDesc(preset.description || '');
    if (preset.items && preset.items.length > 0) {
      setFormItems(
        preset.items.map((item: any) => ({
          content: item.content,
          std: item.std || item.standard_value || '',
          unit: item.unit || '-',
          type: item.type || item.input_type || 'PASS_FAIL'
        }))
      );
    }
  };

  const handleEditChecklist = async (checklist: Checklist) => {
    try {
      const res = await api.getChecklist(checklist.id);
      if (res.success) {
        const full = res.data;
        setEditingChecklist(full);
        setFormTitle(full.title);
        setFormCategory(full.category || 'Kiểm tra định kỳ');
        setFormDeviceType(full.target_device_type || 'ALL');
        setFormVersion(full.version || '1.0');
        setFormDesc(full.description || '');
        if (full.items && full.items.length > 0) {
          setFormItems(
            full.items.map((item: any) => ({
              content: item.content,
              std: item.standard_value || '',
              unit: item.unit || '-',
              type: item.input_type || 'PASS_FAIL'
            }))
          );
        } else {
          setFormItems([{ content: '', std: '', unit: '-', type: 'PASS_FAIL' }]);
        }
        setShowChecklistModal(true);
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi khi tải chi tiết checklist');
    }
  };

  const handleCreateChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle) return;

    setSubmitting(true);
    try {
      const payload = {
        title: formTitle,
        category: formCategory,
        target_device_type: formDeviceType,
        version: formVersion,
        description: formDesc,
        items: formItems.map((item, idx) => ({
          item_code: `ITM-${String(idx + 1).padStart(2, '0')}`,
          content: item.content,
          standard_value: item.std,
          unit: item.unit,
          input_type: item.type
        }))
      };

      let res;
      if (editingChecklist) {
        res = await api.updateChecklist(editingChecklist.id, payload);
      } else {
        res = await api.createChecklist(payload);
      }

      if (res.success) {
        alert(editingChecklist ? 'Cập nhật mẫu checklist thành công!' : 'Tạo mới mẫu checklist thành công!');
        setShowChecklistModal(false);
        resetChecklistForm();
        loadChecklists();
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi xử lý mẫu checklist');
    } finally {
      setSubmitting(false);
    }
  };

  const resetChecklistForm = () => {
    setEditingChecklist(null);
    setFormTitle('');
    setFormCategory('Kiểm tra định kỳ');
    setFormDeviceType('REC');
    setFormVersion('2026.1');
    setFormDesc('');
    setFormItems([{ content: 'Kiểm tra ngoại quan vỏ và hệ thống tiếp địa', std: 'Sạch sẽ, tiếp địa chắc chắn', unit: '-', type: 'PASS_FAIL' }]);
  };

  const handleCloneChecklist = async (id: number) => {
    try {
      const res = await api.cloneChecklist(id);
      if (res.success) {
        alert('Nhân bản mẫu checklist thành công!');
        loadChecklists();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteChecklist = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa mẫu checklist này?')) return;
    try {
      const res = await api.deleteChecklist(id);
      if (res.success) loadChecklists();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCreateScheduleFromChecklist = (c: Checklist) => {
    setSchChecklistId(String(c.id));
    setSchTitle(`Lịch kiểm tra định kỳ ${c.target_device_type} (${c.title})`);
    setActiveTab('schedules');
    setShowScheduleModal(true);
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schTitle || !schDeviceId || !schChecklistId) {
      alert('Vui lòng điền đầy đủ thông tin Tên lịch, Thiết bị và Checklist.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createSchedule({
        title: schTitle,
        frequency: schFrequency,
        device_id: schDeviceId ? schDeviceId : null,
        checklist_id: schChecklistId ? schChecklistId : null,
        assigned_team: schTeam,
        next_run_date: schNextDate
      });

      if (res.success) {
        alert('Tạo lịch kiểm tra định kỳ thành công!');
        setShowScheduleModal(false);
        setSchTitle('');
        loadSchedules();
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateTasksFromSchedules = async () => {
    try {
      const res = await api.generateScheduleTasks();
      if (res.success) {
        alert(res.message);
        loadSchedules();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteSchedule = async (id: number, reason: string) => {
    try {
      const res = await api.deleteSchedule(id, { reason });
      if (res.success) {
        alert('Đã xóa lịch kiểm tra định kỳ');
        setDeletingSchedule(null);
        setDeleteReason('');
        loadSchedules();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRestoreSchedule = async (id: number) => {
    if (!confirm('Khôi phục lịch này?')) return;
    try {
      const res = await api.restoreSchedule(id);
      if (res.success) {
        alert('Đã khôi phục lịch kiểm tra');
        loadSchedules();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Banner & Title */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-blue-700 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Thư viện Tiêu chuẩn Kỹ thuật Lưới điện</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Mẫu Checklist & Lịch Kiểm tra EVN</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Quản lý kho mẫu biên bản kiểm tra định kỳ Recloser, LBS, RMU, DS theo quy chuẩn Đội VHLĐ - PC Bình Dương và tự động lập lịch sinh công việc.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'templates' ? (
            <>
              <button
                onClick={handleSyncEVNStandards}
                disabled={syncingTemplates}
                className="inline-flex items-center justify-center px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl shadow-2xs transition space-x-1.5 cursor-pointer disabled:opacity-50"
                title="Đồng bộ lại toàn bộ mẫu chuẩn EVN từ hệ thống"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${syncingTemplates ? 'animate-spin' : ''}`} />
                <span>{syncingTemplates ? 'Đang đồng bộ...' : 'Đồng bộ Mẫu Chuẩn EVN'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleGenerateTasksFromSchedules}
                className="inline-flex items-center justify-center px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition space-x-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Sinh công việc ngay</span>
              </button>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs transition space-x-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm lịch định kỳ</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-6">
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center space-x-2 ${
            activeTab === 'templates'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Thư viện Mẫu Checklist ({checklists.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('schedules')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center space-x-2 ${
            activeTab === 'schedules'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Lịch kiểm tra tự động ({schedules.length})</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: CHECKLIST TEMPLATES */}
      {/* ======================================================== */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {/* Preset Quick Loader Banner */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <span className="font-bold text-sm">Kho Mẫu Tiêu Chuẩn Ngành Điện (EVN Standard Presets)</span>
              </div>
              <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-medium">Đội VHLĐ - PC Bình Dương</span>
            </div>
            <p className="text-xs text-blue-100">
              Các mẫu biên bản kiểm tra định kỳ hoàn chỉnh theo biểu mẫu văn bản chính thức với đầy đủ hạng mục kiểm tra ngoại quan, tiếp địa, điện trở Rđ, đo nhiệt độ mối nối, kiểm tra áp suất khí SF6 và đo kiểm tra nội trở/điện áp ắc quy DC.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    handleApplyPreset(p);
                    setShowChecklistModal(true);
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-semibold text-white flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <FileCheck className="w-3.5 h-3.5 text-blue-300" />
                  <span>{p.title.replace('Biên bản Kiểm tra Định kỳ ', '').replace('Biên bản Kiểm tra ', '')}</span>
                  <span className="text-[10px] bg-blue-500/50 px-1 rounded">{p.target_device_type}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã checklist, tên tiêu chuẩn, thiết bị..."
                value={checklistSearch}
                onChange={(e) => setChecklistSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadChecklists()}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Filter Chips */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs font-bold text-slate-500 flex items-center space-x-1 mr-1">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Loại TB:</span>
              </span>
              {[
                { label: 'Tất cả', val: 'ALL' },
                { label: 'Recloser (REC)', val: 'REC' },
                { label: 'Dao cắt (LBS)', val: 'LBS' },
                { label: 'Tủ RMU', val: 'RMU' },
                { label: 'Dao cách ly (DS)', val: 'DS' }
              ].map((chip) => (
                <button
                  key={chip.val}
                  onClick={() => {
                    setFilterDeviceType(chip.val);
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition shrink-0 cursor-pointer ${
                    filterDeviceType === chip.val
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Checklist Cards Grid */}
          {loadingChecklists ? (
            <div className="py-12 text-center text-slate-500 text-sm">Đang tải danh sách mẫu checklist...</div>
          ) : checklists.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
              <FileCheck className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-slate-600 font-bold">Không tìm thấy mẫu checklist nào</p>
              <button
                onClick={handleSyncEVNStandards}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 cursor-pointer"
              >
                Khôi phục Mẫu Tiêu chuẩn EVN
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {checklists
                .filter(c => filterDeviceType === 'ALL' || c.target_device_type === filterDeviceType || c.target_device_type === 'ALL')
                .map((c) => (
                <div
                  key={c.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {c.checklist_code}
                        </span>
                        <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          TB: {c.target_device_type}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        v{c.version}
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-slate-900 leading-snug">{c.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2">{c.description || 'Chưa có mô tả chi tiết'}</p>

                    <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold flex items-center space-x-1">
                        <ListPlus className="w-3.5 h-3.5 text-blue-600" />
                        <span>{c.item_count || 0} tiêu chuẩn kiểm tra</span>
                      </span>
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-medium">
                        {c.category}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleOpenPreview(c)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition cursor-pointer"
                        title="Xem chi tiết và biểu mẫu biên bản in ấn"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem Biên bản Mẫu</span>
                      </button>
                      <button
                        onClick={() => handleCreateScheduleFromChecklist(c)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
                        title="Tạo lịch kiểm tra tự động từ mẫu này"
                      >
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Lập lịch</span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleEditChecklist(c)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 cursor-pointer"
                        title="Chỉnh sửa nội dung checklist"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCloneChecklist(c.id)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 cursor-pointer"
                        title="Nhân bản mẫu checklist"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteChecklist(c.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                        title="Xóa mẫu checklist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: INSPECTION SCHEDULES */}
      {/* ======================================================== */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Hệ thống tự động quét lịch định kỳ hàng ngày và tự động khởi tạo công việc kiểm tra cho Đội Vận hành khi đến hạn.</span>
            </div>
            <button
              onClick={handleGenerateTasksFromSchedules}
              className="px-3 py-1.5 bg-emerald-700 text-white font-bold rounded-lg hover:bg-emerald-800 transition cursor-pointer shrink-0"
            >
              Kích hoạt sinh việc ngay
            </button>
          </div>

          {loadingSchedules ? (
            <div className="py-12 text-center text-slate-500 text-sm">Đang tải lịch kiểm tra định kỳ...</div>
          ) : (
            <div className="space-y-4">
              {hasRole('ADMIN') && (
                <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDeleted}
                    onChange={(e) => setShowDeleted(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Hiển thị lịch đã xóa</span>
                </label>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider">
                      <tr>
                        <th className="p-3.5">Mã Lịch</th>
                        <th className="p-3.5">Tên Lịch Kiểm Tra</th>
                        <th className="p-3.5">Tần Suất</th>
                        <th className="p-3.5">Thiết Bị</th>
                        <th className="p-3.5">Checklist Đính Kèm</th>
                        <th className="p-3.5">Ngày Thực Hiện Tiếp</th>
                        <th className="p-3.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedules
                        .filter(s => showDeleted || s.status !== 'DELETED')
                        .map((s) => (
                        <tr key={s.id} className={`hover:bg-slate-50 transition ${s.status === 'DELETED' ? 'bg-red-50' : ''}`}>
                          <td className="p-3.5 font-mono font-bold text-blue-700">{s.schedule_code}</td>
                          <td className="p-3.5 font-bold text-slate-900">{s.title}</td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-800 font-bold rounded border border-blue-200">
                              {s.frequency}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-800 font-medium">{s.device_code} ({s.device_name})</td>
                          <td className="p-3.5 text-slate-700">{s.checklist_title}</td>
                          <td className="p-3.5 font-semibold text-emerald-700 font-mono text-xs">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{formatDateTime(s.next_run_date)}</span>
                            </div>
                          </td>
                          <td className="p-3.5 text-right">
                            {s.status !== 'DELETED' ? (
                              hasRole('ADMIN') && (
                                <button
                                  onClick={() => setDeletingSchedule(s)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                                  title="Xóa lịch kiểm tra"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )
                            ) : (
                              <button
                                onClick={() => handleRestoreSchedule(s.id)}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 rounded cursor-pointer"
                                title="Khôi phục lịch kiểm tra"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* OFFICIAL EVN FORM PREVIEW & PRINT MODAL */}
      {/* ======================================================== */}
      {previewChecklist && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden border border-slate-200 my-6 flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:m-0 print:w-full">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center space-x-2">
                <FileCheck className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">Xem Mẫu Biên Bản Kiểm Tra Kỹ Thuật (Chuẩn EVN)</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center space-x-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In Biên Bản (A4)</span>
                </button>
                <button
                  onClick={() => setPreviewChecklist(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Content - Styled as official EVN inspection sheet */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-900 font-sans text-xs sm:text-sm bg-white print:p-0 print:text-black">
              {/* EVN Header */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-300">
                <div className="space-y-0.5">
                  <p className="font-bold uppercase text-[11px] sm:text-xs">TỔNG CÔNG TY ĐIỆN LỰC MIỀN NAM</p>
                  <p className="font-bold uppercase text-xs sm:text-sm text-blue-900 print:text-black">CÔNG TY ĐIỆN LỰC BÌNH DƯƠNG</p>
                  <p className="font-semibold text-xs text-slate-700 underline underline-offset-2">ĐỘI VẬN HÀNH LƯỚI ĐIỆN</p>
                  <p className="text-[11px] text-slate-500 font-mono">Mã checklist: {previewChecklist.checklist_code}</p>
                </div>
                <div className="text-right space-y-0.5">
                  <p className="font-bold uppercase text-[11px] sm:text-xs">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                  <p className="font-semibold text-xs underline underline-offset-4">Độc lập - Tự do - Hạnh phúc</p>
                  <p className="text-[11px] text-slate-500 italic pt-1">Bình Dương, ngày ...... tháng ...... năm 202...</p>
                </div>
              </div>

              {/* Document Title */}
              <div className="text-center py-2 space-y-1">
                <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-wide text-slate-900 print:text-black">
                  {previewChecklist.title}
                </h2>
                <p className="text-xs text-slate-600 italic">
                  (Ban hành theo quy định kiểm tra kỹ thuật định kỳ thiết bị phân phối trung thế)
                </p>
                <div className="flex items-center justify-center space-x-4 text-xs text-slate-600 pt-1">
                  <span>Phiên bản: <strong>v{previewChecklist.version}</strong></span>
                  <span>•</span>
                  <span>Loại thiết bị: <strong>{previewChecklist.target_device_type}</strong></span>
                  <span>•</span>
                  <span>Hạng mục: <strong>{previewChecklist.category}</strong></span>
                </div>
              </div>

              {/* Section I: Equipment Details Form */}
              <div className="space-y-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 bg-slate-100 p-2 rounded print:bg-slate-200">
                  I. THÔNG TIN THIẾT BỊ VẬN HÀNH & HIỆN TRƯỜNG
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 p-2 border border-slate-200 rounded-lg text-xs">
                  <div>Tên / Chỉ danh thiết bị: <strong className="font-mono">................................................</strong></div>
                  <div>Trạm / Tuyến xuất tuyến: <strong>................................................</strong></div>
                  <div>Vị trí trụ / Số cột: <strong>................................................</strong></div>
                  <div>Đơn vị quản lý: <strong>Đội Vận hành Lưới điện</strong></div>
                  <div>Hãng / Nước sản xuất: <strong>................................................</strong></div>
                  <div>Năm đóng điện / Vận hành: <strong>................................................</strong></div>
                </div>
              </div>

              {/* Section II: Inspection Team */}
              <div className="space-y-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 bg-slate-100 p-2 rounded print:bg-slate-200">
                  II. THÀNH PHẦN NHÓM KIỂM TRA
                </h3>
                <div className="p-2 border border-slate-200 rounded-lg text-xs space-y-1">
                  <div className="grid grid-cols-3 gap-2 font-semibold text-slate-600 pb-1 border-b border-slate-100">
                    <div>1. Họ và tên người kiểm tra</div>
                    <div>Chức danh / Bậc thợ</div>
                    <div>Bậc An toàn điện</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>1. ....................................................</div>
                    <div>....................................................</div>
                    <div>Bậc ...../5</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>2. ....................................................</div>
                    <div>....................................................</div>
                    <div>Bậc ...../5</div>
                  </div>
                </div>
              </div>

              {/* Section III: Checklist Items Table */}
              <div className="space-y-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 bg-slate-100 p-2 rounded print:bg-slate-200">
                  III. NỘI DUNG TIÊU CHUẨN KIỂM TRA ĐỊNH KỲ ({previewItems.length} HẠNG MỤC)
                </h3>
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-300">
                      <th className="border border-slate-300 p-2 w-10 text-center">STT</th>
                      <th className="border border-slate-300 p-2 text-left">Nội dung kiểm tra</th>
                      <th className="border border-slate-300 p-2 text-left w-1/3">Tiêu chuẩn kỹ thuật / Giá trị chuẩn</th>
                      <th className="border border-slate-300 p-2 text-center w-16">Đơn vị</th>
                      <th className="border border-slate-300 p-2 text-center w-28">Kết quả kiểm tra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50">
                        <td className="border border-slate-300 p-2 text-center font-mono font-bold text-slate-600">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-300 p-2 font-medium text-slate-900">
                          <div>{item.content}</div>
                          <span className="text-[10px] font-mono text-slate-400">[{item.item_code}]</span>
                        </td>
                        <td className="border border-slate-300 p-2 text-slate-700 font-medium">
                          {item.standard_value ? (
                            <span className="text-emerald-800 font-bold">{item.standard_value}</span>
                          ) : (
                            <span className="text-slate-400 italic">Theo quy chuẩn</span>
                          )}
                        </td>
                        <td className="border border-slate-300 p-2 text-center text-slate-600 font-mono">
                          {item.unit || '-'}
                        </td>
                        <td className="border border-slate-300 p-2 text-center text-slate-500">
                          {item.input_type === 'PASS_FAIL' ? (
                            <div className="flex items-center justify-center space-x-2 text-[11px]">
                              <span>[ ] Đạt</span>
                              <span>[ ] K.Đạt</span>
                            </div>
                          ) : item.input_type === 'NUMBER' ? (
                            <span className="italic">.......... {item.unit !== '-' ? item.unit : ''}</span>
                          ) : (
                            <span className="italic">...................</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Section IV: Notes & Proposals */}
              <div className="space-y-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 bg-slate-100 p-2 rounded print:bg-slate-200">
                  IV. CÁC ĐỀ XUẤT XỬ LÝ & KIẾN NGHỊ KỸ THUẬT
                </h3>
                <div className="p-3 border border-slate-200 rounded-lg text-xs min-h-16 text-slate-500 italic space-y-2">
                  <p>- Tình trạng thiết bị sau kiểm tra: [ ] Đủ điều kiện vận hành an toàn &nbsp;&nbsp;&nbsp;&nbsp; [ ] Cần theo dõi &nbsp;&nbsp;&nbsp;&nbsp; [ ] Cần xử lý khẩn cấp</p>
                  <p>- Kiến nghị cụ thể: ....................................................................................................................................................................................</p>
                  <p>........................................................................................................................................................................................................................</p>
                </div>
              </div>

              {/* Section V: Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-4 pb-2 text-center text-xs">
                <div className="space-y-16">
                  <p className="font-bold uppercase">NGƯỜI KIỂM TRA</p>
                  <p className="italic text-slate-500">(Ký và ghi rõ họ tên)</p>
                </div>
                <div className="space-y-16">
                  <p className="font-bold uppercase">ĐẠI DIỆN ĐỘI VẬN HÀNH LƯỚI ĐIỆN</p>
                  <p className="italic text-slate-500">(Ký và ghi rõ họ tên)</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleCreateScheduleFromChecklist(previewChecklist)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Lập lịch kiểm tra từ mẫu này</span>
                </button>
                <button
                  onClick={() => {
                    handleEditChecklist(previewChecklist);
                    setPreviewChecklist(null);
                  }}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Chỉnh sửa nội dung</span>
                </button>
              </div>

              <button
                onClick={() => setPreviewChecklist(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CREATE / EDIT CHECKLIST MODAL */}
      {/* ======================================================== */}
      {showChecklistModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden border border-slate-100 my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckSquare className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">
                  {editingChecklist ? `Chỉnh sửa Mẫu Checklist: ${editingChecklist.checklist_code}` : 'Thiết lập Mẫu Checklist Kiểm tra Kỹ thuật Mới'}
                </h3>
              </div>
              <button onClick={() => setShowChecklistModal(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            {/* Quick Presets Picker */}
            {!editingChecklist && presets.length > 0 && (
              <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between gap-2 overflow-x-auto">
                <span className="text-xs font-bold text-blue-900 shrink-0 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Nạp nhanh mẫu chuẩn:</span>
                </span>
                <div className="flex items-center space-x-2 shrink-0">
                  {presets.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="px-2.5 py-1 bg-white hover:bg-blue-600 hover:text-white border border-blue-200 text-blue-800 text-[11px] font-bold rounded-lg transition cursor-pointer"
                    >
                      {p.target_device_type}: {p.title.replace('Biên bản Kiểm tra Định kỳ ', '').replace('Biên bản Kiểm tra ', '')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleCreateChecklist} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên mẫu checklist <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Biên bản Kiểm tra Máy cắt Tự đóng lại Trung thế (Recloser)"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Loại thiết bị áp dụng</label>
                  <select
                    value={formDeviceType}
                    onChange={(e) => setFormDeviceType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="REC">REC (Recloser)</option>
                    <option value="LBS">LBS (Dao cắt phụ tải)</option>
                    <option value="RMU">RMU (Tủ đóng cắt Ring Main Unit)</option>
                    <option value="DS">DS (Dao cách ly)</option>
                    <option value="ALL">Tất cả thiết bị</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Danh mục kiểm tra</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phiên bản</label>
                  <input
                    type="text"
                    value={formVersion}
                    onChange={(e) => setFormVersion(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả & Căn cứ kỹ thuật</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={2}
                  placeholder="Căn cứ quy định kiểm tra kỹ thuật định kỳ của Đội VHLĐ - PC Bình Dương..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              {/* Items List Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Danh sách Tiêu chuẩn kiểm tra ({formItems.length} hạng mục)
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormItems([...formItems, { content: '', std: '', unit: '-', type: 'PASS_FAIL' }])}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer bg-blue-50 px-2.5 py-1 rounded-lg"
                  >
                    <ListPlus className="w-3.5 h-3.5" />
                    <span>Thêm tiêu chuẩn</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formItems.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-slate-700">Hạng mục #{idx + 1}</span>
                        {formItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer"
                          >
                            Xóa
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        required
                        placeholder="Nội dung kiểm tra (VD: Đo nhiệt độ má dao, tiếp địa...)"
                        value={item.content}
                        onChange={(e) => {
                          const next = [...formItems];
                          next[idx].content = e.target.value;
                          setFormItems(next);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Tiêu chuẩn chuẩn (VD: <= 65°C, Rđ <= 10 Ω)"
                          value={item.std}
                          onChange={(e) => {
                            const next = [...formItems];
                            next[idx].std = e.target.value;
                            setFormItems(next);
                          }}
                          className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                        />

                        <input
                          type="text"
                          placeholder="Đơn vị (VD: °C, Ω, Bar, V/mΩ, -)"
                          value={item.unit}
                          onChange={(e) => {
                            const next = [...formItems];
                            next[idx].unit = e.target.value;
                            setFormItems(next);
                          }}
                          className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                        />

                        <select
                          value={item.type}
                          onChange={(e) => {
                            const next = [...formItems];
                            next[idx].type = e.target.value;
                            setFormItems(next);
                          }}
                          className="px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                        >
                          <option value="PASS_FAIL">Đạt / Không đạt</option>
                          <option value="NUMBER">Nhập số đo</option>
                          <option value="TEXT">Văn bản / Ghi chú</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowChecklistModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu mẫu checklist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CREATE SCHEDULE MODAL */}
      {/* ======================================================== */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">Thêm Lịch Kiểm tra Tự động</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateSchedule} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên lịch kiểm tra <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Lịch kiểm tra hàng tháng LBS 471-01"
                  value={schTitle}
                  onChange={(e) => setSchTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tần suất kiểm tra</label>
                  <select
                    value={schFrequency}
                    onChange={(e) => setSchFrequency(e.target.value as InspectionFrequency)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="DAILY">Hàng ngày</option>
                    <option value="WEEKLY">Hàng tuần</option>
                    <option value="MONTHLY">Hàng tháng</option>
                    <option value="QUARTERLY">Hàng quý</option>
                    <option value="YEARLY">Hàng năm</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Thiết bị áp dụng <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={schDeviceId}
                    onChange={(e) => setSchDeviceId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- Chọn thiết bị --</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.device_id} ({d.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mẫu Checklist kiểm tra <span className="text-red-500">*</span></label>
                <select
                  required
                  value={schChecklistId}
                  onChange={(e) => setSchChecklistId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">-- Chọn mẫu checklist --</option>
                  {checklists.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.checklist_code}: {c.title} ({c.target_device_type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Đang tạo...' : 'Tạo lịch kiểm tra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DELETE SCHEDULE MODAL */}
      {/* ======================================================== */}
      {deletingSchedule && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100">
            <div className="px-6 py-4 bg-red-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Xác nhận xóa lịch kiểm tra
              </h3>
              <button onClick={() => setDeletingSchedule(null)} className="text-white/80 hover:text-white cursor-pointer">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700">Bạn có chắc chắn muốn xóa lịch kiểm tra này không?</p>
              <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
                <p><b>Lịch:</b> {deletingSchedule.title}</p>
                <p><b>Thiết bị:</b> {deletingSchedule.device_name}</p>
                <p><b>Ngày kiểm tra tiếp:</b> {formatDate(deletingSchedule.next_run_date)}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Lý do xóa <span className="text-red-500">*</span></label>
                <textarea
                  required
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  rows={3}
                  placeholder="Nhập lý do xóa..."
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end space-x-3">
              <button
                onClick={() => setDeletingSchedule(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-100 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => handleDeleteSchedule(deletingSchedule.id, deleteReason)}
                disabled={!deleteReason.trim()}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
