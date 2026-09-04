import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RotateCcw,
  UserCheck,
  ChevronRight,
  FileCheck2,
  MapPin,
  Calendar,
  User,
  Shield,
  Layers,
  Sparkles,
  Camera,
  MessageSquare,
  Eye,
  Trash2,
  ExternalLink,
  Check,
  CheckSquare,
  Square,
  Zap,
  ListFilter,
  X,
  History,
  Play,
  Pause,
  Send,
  Award,
  AlertCircle,
  Lock,
  ArrowRight,
  Sliders,
  Archive,
  FolderArchive,
  Clock4,
  CheckCheck,
  Printer,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useDataContext } from '../context/DataContext';
import { Task, TaskPriority, TaskStatus, Checklist, User as UserType, TaskHistory } from '../types';
import { formatDateTime, formatRelativeTime, formatDate } from '../utils/dateTime';
import { PrintChecklistModal } from '../components/PrintChecklistModal';

export const TasksPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const { devices, fetchDevices } = useDataContext();
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'archived'>('all');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [myArchivedCount, setMyArchivedCount] = useState<number>(0);
  const [allArchivedCount, setAllArchivedCount] = useState<number>(0);
  const [archivedScope, setArchivedScope] = useState<'my' | 'all'>('my');
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  // Modals & Detail
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailActiveTab, setDetailActiveTab] = useState<'content' | 'history'>('content');

  // Action Modals
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressInput, setProgressInput] = useState<number>(50);
  const [progressNotes, setProgressNotes] = useState<string>('');

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvalNotesInput, setApprovalNotesInput] = useState<string>('');

  const [showReworkModal, setShowReworkModal] = useState(false);
  const [reworkReasonInput, setReworkReasonInput] = useState<string>('');

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReasonInput, setReturnReasonInput] = useState<string>('');

  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReasonInput, setPauseReasonInput] = useState<string>('');

  // Dropdown reference data
  const [usersList, setUsersList] = useState<UserType[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);

  // Create Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDeviceSelectionMode, setFormDeviceSelectionMode] = useState<'multiple' | 'single' | 'none'>('multiple');
  const [formSelectedDeviceIds, setFormSelectedDeviceIds] = useState<number[]>([]);
  const [formDeviceId, setFormDeviceId] = useState<string>('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceFilterFeeder, setDeviceFilterFeeder] = useState('');
  const [deviceFilterType, setDeviceFilterType] = useState('');
  const [formAssignedUserId, setFormAssignedUserId] = useState<string>('');
  const [formTeam, setFormTeam] = useState('ĐỘI VẬN HÀNH LƯỚI ĐIỆN');
  const [formChecklistId, setFormChecklistId] = useState<string>('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('MEDIUM');
  const [formContent, setFormContent] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Submit checklist results state
  const [printDeviceChecklist, setPrintDeviceChecklist] = useState<any>(null);
  const [itemResults, setItemResults] = useState<Record<string, { result_value: string; is_pass: boolean; notes: string }>>({});

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const statusParam = params.get('status');
      const taskIdParam = params.get('taskId');
      if (statusParam) {
        setStatusFilter(statusParam);
      }
      if (taskIdParam) {
        api.getTask(taskIdParam).then((res) => {
          if (res.success && res.data) {
            setSelectedTask(res.data);
            setShowDetailModal(true);
          }
        }).catch(console.error);
      }
    } catch (e) {
      console.error('Error parsing URL params:', e);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadRefData();
  }, [statusFilter, priorityFilter, activeTab, archivedScope]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allRes, myRes, myArchivedRes, allArchivedRes] = await Promise.all([
        api.getTasks({
          search: searchTerm,
          status: statusFilter,
          priority: priorityFilter,
          archived: 'false'
        }),
        api.getMyTasks({
          search: searchTerm,
          status: statusFilter,
          priority: priorityFilter,
          archived: 'false'
        }),
        api.getMyTasks({
          search: searchTerm,
          archived: 'only'
        }),
        api.getTasks({
          search: searchTerm,
          archived: 'only'
        })
      ]);

      if (allRes.success) {
        setTasks(allRes.data || []);
        if (allRes.archived_count !== undefined) {
          setAllArchivedCount(allRes.archived_count);
        }
      }
      if (myRes.success) {
        setMyTasks(myRes.data || []);
        if (myRes.archived_count !== undefined) {
          setMyArchivedCount(myRes.archived_count);
        }
      }
      if (myArchivedRes.success && allArchivedRes.success) {
        if (archivedScope === 'my') {
          setArchivedTasks(myArchivedRes.data || []);
        } else {
          setArchivedTasks(allArchivedRes.data || []);
        }
        setMyArchivedCount(myArchivedRes.data.length);
        setAllArchivedCount(allArchivedRes.data.length);
      }
    } catch (e) {
      console.error('Error loading tasks:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadRefData = async () => {
    try {
      fetchDevices();
      const [userRes, chkRes] = await Promise.all([
        api.getAssignableUsers(),
        api.getChecklists()
      ]);
      if (userRes.success) setUsersList(userRes.data || (userRes as any).users || []);
      if (chkRes.success) setChecklists(chkRes.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const openTaskDetail = async (taskId: number) => {
    try {
      const res = await api.getTask(taskId);
      if (res.success) {
        setSelectedTask(res.data);
        setDetailActiveTab('content');
        // Initialize checklist item results state
        const initialResults: Record<string, { result_value: string; is_pass: boolean; notes: string }> = {};
        
        if (res.data.task_devices && res.data.task_devices.length > 0) {
          res.data.task_devices.forEach((td: any) => {
            if (td.checklist_items) {
              td.checklist_items.forEach((item: any) => {
                const existingRes = td.results?.find((r: any) => r.checklist_item_id === item.id);
                initialResults[`${td.device_id}_${item.id}`] = {
                  result_value: existingRes?.result_value || '',
                  is_pass: existingRes ? Boolean(existingRes.is_pass) : true,
                  notes: existingRes?.notes || ''
                };
              });
            }
          });
        }
        
        if (res.data.checklist_items) {
          res.data.checklist_items.forEach((item: any) => {
            const existingRes = res.data.results?.find((r: any) => r.checklist_item_id === item.id && !r.device_id);
            initialResults[`legacy_${item.id}`] = {
              result_value: existingRes?.result_value || '',
              is_pass: existingRes ? Boolean(existingRes.is_pass) : true,
              notes: existingRes?.notes || ''
            };
          });
        }
        setItemResults(initialResults);
        setShowDetailModal(true);
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi khi mở chi tiết công việc');
    }
  };

  // Filter devices in create modal
  const filteredModalDevices = devices.filter((d) => {
    if (deviceFilterFeeder && String(d.feeder_id) !== String(deviceFilterFeeder) && d.feeder_name !== deviceFilterFeeder) {
      return false;
    }
    if (deviceFilterType && d.device_type !== deviceFilterType) {
      return false;
    }
    if (deviceSearch.trim()) {
      const q = deviceSearch.toLowerCase().trim();
      const matchId = (d.device_id || '').toLowerCase().includes(q);
      const matchName = (d.name || '').toLowerCase().includes(q);
      const matchPole = (d.pole_number || '').toLowerCase().includes(q);
      const matchFeeder = (d.feeder_name || '').toLowerCase().includes(q);
      const matchStation = (d.substation_name || '').toLowerCase().includes(q);
      if (!matchId && !matchName && !matchPole && !matchFeeder && !matchStation) {
        return false;
      }
    }
    return true;
  });

  const toggleDeviceSelect = (id: number) => {
    setFormSelectedDeviceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllFilteredDevices = () => {
    const idsToAdd = filteredModalDevices.map((d) => d.id);
    setFormSelectedDeviceIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const handleDeselectAllFilteredDevices = () => {
    const idsToRemove = new Set(filteredModalDevices.map((d) => d.id));
    setFormSelectedDeviceIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
  };

  const handleClearAllSelectedDevices = () => {
    setFormSelectedDeviceIds([]);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateTask) {
      alert('Chỉ tài khoản có phân quyền “Cán bộ phương thức” hoặc “Quản trị hệ thống (Admin)” mới có quyền giao việc mới!');
      return;
    }

    if (!formTitle || !formContent || !formDueDate) {
      alert('Vui lòng nhập Tên công việc, Nội dung và Hạn hoàn thành.');
      return;
    }

    if (formDeviceSelectionMode === 'multiple' && formSelectedDeviceIds.length === 0) {
      const confirmNoDev = window.confirm('Bạn chưa chọn thiết bị nào trong danh sách. Bạn có muốn tạo công việc chung không gắn với thiết bị cụ thể?');
      if (!confirmNoDev) return;
    }

    setSubmitting(true);
    try {
      const selectedUser = usersList.find((u) => String(u.id) === formAssignedUserId);
      const payload: any = {
        title: formTitle,
        assigned_to_user_id: formAssignedUserId ? formAssignedUserId : null,
        assigned_to_username: selectedUser?.username || null,
        assigned_to_fullname: selectedUser?.full_name || null,
        team: formTeam,
        checklist_id: formChecklistId ? formChecklistId : null,
        due_date: formDueDate,
        priority: formPriority,
        content: formContent,
        notes: formNotes
      };

      if (formDeviceSelectionMode === 'multiple') {
        payload.device_ids = formSelectedDeviceIds;
      } else if (formDeviceSelectionMode === 'single') {
        payload.device_id = formDeviceId ? formDeviceId : null;
      } else {
        payload.device_id = null;
      }

      const res = await api.createTask(payload);

      if (res.success) {
        const msg = res.message || (Array.isArray(res.data) 
          ? `Giao thành công ${res.data.length} công việc cho nhân viên!` 
          : 'Giao công việc thành công!');
        alert(msg);
        setShowCreateModal(false);
        resetCreateForm();
        loadData();
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi khi tạo công việc');
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setFormTitle('');
    setFormDeviceSelectionMode('multiple');
    setFormSelectedDeviceIds([]);
    setFormDeviceId('');
    setDeviceSearch('');
    setDeviceFilterFeeder('');
    setDeviceFilterType('');
    setFormAssignedUserId('');
    setFormChecklistId('');
    setFormDueDate('');
    setFormPriority('MEDIUM');
    setFormContent('');
    setFormNotes('');
  };

  // 1. NHẬN VIỆC (Employee only)
  const handleAcceptTask = async (taskId: number) => {
    try {
      const res = await api.acceptTask(taskId);
      if (res.success) {
        alert(res.message || 'Đã tiếp nhận công việc thành công!');
        if (showDetailModal && selectedTask?.id === taskId) {
          openTaskDetail(taskId);
        }
        loadData();
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi khi tiếp nhận công việc');
    }
  };

  // 2. BẮT ĐẦU LÀM (Employee only)
  const handleStartTask = async (taskId: number) => {
    try {
      const res = await api.startTask(taskId);
      if (res.success) {
        alert(res.message || 'Đã bắt đầu triển khai công việc!');
        if (showDetailModal && selectedTask?.id === taskId) {
          openTaskDetail(taskId);
        }
        loadData();
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi khi bắt đầu thực hiện công việc');
    }
  };

  // 3. CẬP NHẬT TIẾN ĐỘ (Employee only)
  const handleSaveProgress = async () => {
    if (!selectedTask) return;
    try {
      const res = await api.updateTaskProgress(selectedTask.id, {
        progress: progressInput,
        notes: progressNotes
      });
      if (res.success) {
        alert(res.message || `Đã cập nhật tiến độ ${progressInput}%`);
        setShowProgressModal(false);
        openTaskDetail(selectedTask.id);
        loadData();
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi khi cập nhật tiến độ');
    }
  };

  // 4. GỬI HOÀN TẤT -> CHỜ XÁC NHẬN (Employee only)
  const handleSubmitChecklistResults = async () => {
    if (!selectedTask) return;
    setSubmitting(true);

    try {
      const formattedResults = Object.entries(itemResults).map(([key, val]: [string, any]) => {
        const [devIdStr, itemIdStr] = key.split('_');
        let itemObj;
        if (devIdStr === 'legacy') {
           itemObj = selectedTask.checklist_items?.find((i: any) => String(i.id) === String(itemIdStr));
        } else {
           const td = selectedTask.task_devices?.find((t: any) => String(t.device_id) === String(devIdStr));
           itemObj = td?.checklist_items?.find((i: any) => String(i.id) === String(itemIdStr));
        }
        return {
          device_id: devIdStr === 'legacy' ? undefined : devIdStr,
          checklist_item_id: itemIdStr,
          item_content: itemObj?.content || '',
          standard_value: itemObj?.standard_value || '',
          unit: itemObj?.unit || '',
          result_value: val.result_value,
          is_pass: val.is_pass,
          notes: val.notes
        };
      });

      const res = await api.submitTaskResults(selectedTask.id, {
        results: formattedResults,
        notes: selectedTask.notes
      });

      if (res.success) {
        alert(res.message || 'Đã gửi kết quả hoàn tất công việc! Trạng thái chuyển sang Chờ xác nhận.');
        openTaskDetail(selectedTask.id);
        loadData();
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi khi gửi kết quả hoàn tất');
    } finally {
      setSubmitting(false);
    }
  };

  // 5. NGHIỆM THU & XÁC NHẬN HOÀN THÀNH (CAN_BO_PHUONG_THUC / ADMIN only)
  const handleApproveTask = async () => {
    if (!selectedTask) return;
    if (!canApproveTask) {
      alert('Chỉ tài khoản có phân quyền “Cán bộ phương thức” hoặc “Quản trị hệ thống (Admin)” mới có quyền xác nhận hoàn thành công việc!');
      return;
    }
    try {
      const res = await api.approveTask(selectedTask.id, {
        approval_notes: approvalNotesInput
      });
      if (res.success) {
        alert(res.message || 'Đã nghiệm thu và xác nhận hoàn tất công việc!');
        setShowApproveModal(false);
        setApprovalNotesInput('');
        openTaskDetail(selectedTask.id);
        loadData();
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi khi xác nhận hoàn thành');
    }
  };

  // 6. YÊU CẦU LÀM LẠI / TỪ CHỐI DUYỆT (CAN_BO_PHUONG_THUC / ADMIN only)
  const handleRejectCompletion = async () => {
    if (!selectedTask || !reworkReasonInput.trim()) {
      alert('Vui lòng nhập lý do yêu cầu làm lại!');
      return;
    }
    if (!canApproveTask) {
      alert('Chỉ tài khoản có phân quyền “Cán bộ phương thức” hoặc “Quản trị hệ thống (Admin)” mới có quyền yêu cầu làm lại!');
      return;
    }
    try {
      const res = await api.rejectTaskCompletion(selectedTask.id, {
        reason: reworkReasonInput
      });
      if (res.success) {
        alert(res.message || 'Đã gửi yêu cầu làm lại tới người thực hiện!');
        setShowReworkModal(false);
        setReworkReasonInput('');
        openTaskDetail(selectedTask.id);
        loadData();
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi khi gửi yêu cầu làm lại');
    }
  };

  // 7. TRẢ LẠI / TỪ CHỐI NHẬN VIỆC (Employee only)
  const handleReturnTask = async () => {
    if (!selectedTask || !returnReasonInput.trim()) {
      alert('Vui lòng nhập lý do trả lại công việc!');
      return;
    }
    try {
      const res = await api.returnTask(selectedTask.id, {
        return_reason: returnReasonInput
      });
      if (res.success) {
        alert(res.message || 'Đã trả lại công việc!');
        setShowReturnModal(false);
        setReturnReasonInput('');
        openTaskDetail(selectedTask.id);
        loadData();
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi khi trả lại công việc');
    }
  };

  // 8. TẠM DỪNG / TIẾP TỤC
  const handlePauseTask = async () => {
    if (!selectedTask) return;
    try {
      const res = await api.pauseTask(selectedTask.id, {
        reason: pauseReasonInput
      });
      if (res.success) {
        alert(res.message || 'Đã tạm dừng công việc!');
        setShowPauseModal(false);
        setPauseReasonInput('');
        openTaskDetail(selectedTask.id);
        loadData();
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi khi tạm dừng công việc');
    }
  };

  const handleResumeTask = async (taskId: number) => {
    try {
      const res = await api.resumeTask(taskId);
      if (res.success) {
        alert(res.message || 'Đã tiếp tục thực hiện công việc!');
        if (showDetailModal && selectedTask?.id === taskId) {
          openTaskDetail(taskId);
        }
        loadData();
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi khi tiếp tục công việc');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa công việc này không?')) return;
    try {
      const res = await api.deleteTask(taskId);
      if (res.success) {
        loadData();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const getStatusBadge = (status: TaskStatus, isArchived?: boolean, daysSince?: number) => {
    if (status === 'COMPLETED') {
      if (isArchived) {
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
            <Archive className="w-3.5 h-3.5 text-slate-500" />
            <span>Đã lưu trữ ({daysSince !== undefined ? `${daysSince} ngày trước` : '>30 ngày'})</span>
          </span>
        );
      }
      return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">Hoàn tất</span>;
    }
    switch (status) {
      case 'NEW':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-300">Mới</span>;
      case 'ASSIGNED':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300">Đã giao</span>;
      case 'ACCEPTED':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300">Đã nhận việc</span>;
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">Đang thực hiện</span>;
      case 'PENDING_APPROVAL':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-ping" />
            <span>Chờ xác nhận</span>
          </span>
        );
      case 'OVERDUE':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-300">Quá hạn</span>;
      case 'RETURNED':
      case 'REJECTED':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-800 border border-orange-300">Yêu cầu làm lại</span>;
      case 'PAUSED':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">Tạm dừng</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 border border-gray-300">Đã hủy</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  // Status-based color coding for task list cards/rows
  const getTaskRowStyle = (status: TaskStatus, isArchived?: boolean) => {
    if (isArchived) {
      return 'bg-slate-50/90 hover:bg-slate-100/90 border-slate-300 border-l-4 border-l-slate-500 shadow-2xs';
    }
    switch (status) {
      case 'COMPLETED':
        // Green color coding for 'Hoàn tất'
        return 'bg-emerald-50/40 hover:bg-emerald-50/70 border-emerald-200/90 border-l-4 border-l-emerald-500 shadow-2xs';
      case 'IN_PROGRESS':
        // Blue color coding for 'Đang thực hiện'
        return 'bg-blue-50/40 hover:bg-blue-50/70 border-blue-200/90 border-l-4 border-l-blue-500 shadow-2xs';
      case 'PENDING_APPROVAL':
        // Purple color coding for 'Chờ xác nhận'
        return 'bg-purple-50/40 hover:bg-purple-50/70 border-purple-200/90 border-l-4 border-l-purple-500 shadow-2xs';
      case 'ACCEPTED':
        // Cyan color coding for 'Đã nhận việc'
        return 'bg-cyan-50/35 hover:bg-cyan-50/65 border-cyan-200/90 border-l-4 border-l-cyan-500 shadow-2xs';
      case 'ASSIGNED':
        // Indigo color coding for 'Đã giao'
        return 'bg-indigo-50/35 hover:bg-indigo-50/65 border-indigo-200/90 border-l-4 border-l-indigo-500 shadow-2xs';
      case 'RETURNED':
      case 'REJECTED':
        // Orange color coding for 'Yêu cầu làm lại'
        return 'bg-orange-50/40 hover:bg-orange-50/70 border-orange-200/90 border-l-4 border-l-orange-500 shadow-2xs';
      case 'OVERDUE':
        // Red/Rose color coding for 'Quá hạn'
        return 'bg-rose-50/40 hover:bg-rose-50/70 border-rose-200/90 border-l-4 border-l-rose-500 shadow-2xs';
      case 'PAUSED':
        // Amber color coding for 'Tạm dừng'
        return 'bg-amber-50/35 hover:bg-amber-50/65 border-amber-200/90 border-l-4 border-l-amber-500 shadow-2xs';
      case 'CANCELLED':
        // Muted Slate color coding for 'Đã hủy'
        return 'bg-slate-100/70 hover:bg-slate-100 border-slate-200/90 border-l-4 border-l-slate-400 opacity-75 shadow-2xs';
      case 'NEW':
      default:
        // Neutral clean border for 'Mới'
        return 'bg-white hover:bg-slate-50/90 border-slate-200 border-l-4 border-l-slate-400 shadow-2xs';
    }
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'URGENT':
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-red-600 text-white uppercase">Khẩn cấp</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-500 text-white uppercase">Cao</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-blue-500 text-white uppercase">Trung bình</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-slate-400 text-white uppercase">Thấp</span>;
    }
  };

  const checkIsAssignee = (t: Task) => {
    if (!user) return false;
    return (
      (t.assigned_to_user_id && Number(t.assigned_to_user_id) === Number(user.id)) ||
      (t.assigned_to_username && t.assigned_to_username.toLowerCase() === String(user.username).toLowerCase()) ||
      (t.assigned_to_fullname && user.full_name && t.assigned_to_fullname.toLowerCase() === user.full_name.toLowerCase())
    );
  };

  const checkIsCreator = (t: Task) => {
    if (!user) return false;
    return (
      (t.creator_id && Number(t.creator_id) === Number(user.id)) ||
      (t.creator_username && t.creator_username.toLowerCase() === String(user.username).toLowerCase()) ||
      (t.created_by && t.created_by.toLowerCase() === String(user.username).toLowerCase())
    );
  };

  const checkIsSupervisor = () => {
    return hasRole('ADMIN') || hasRole('MANAGER');
  };

  // STRICT REQUIREMENT: Only "Cán bộ phương thức" or "Admin" can create tasks and approve completed tasks
  const isCanBoPhuongThucOrAdmin = () => {
    return hasRole('ADMIN') || hasRole('MANAGER');
  };

  const canCreateTask = isCanBoPhuongThucOrAdmin();
  const canApproveTask = isCanBoPhuongThucOrAdmin();

  const currentList = activeTab === 'all'
    ? tasks
    : activeTab === 'my'
      ? myTasks
      : archivedTasks;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
            <Briefcase className="w-4 h-4" />
            <span>Phân công & Điều hành tác nghiệp</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Quản lý & Giao việc</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Nguyên tắc <strong>“Giao cho ai – chỉ người đó được thực hiện”</strong>. Quy trình: Đã giao → Đã nhận → Đang thực hiện → Chờ xác nhận → Hoàn tất.
          </p>
        </div>

        {/* ONLY "Cán bộ phương thức" or "Admin" can see and use "Giao việc mới" button */}
        {canCreateTask && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-sm transition duration-150 space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Giao việc mới</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'all'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Tất cả công việc ({tasks.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'my'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Công việc của tôi</span>
          <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${
            activeTab === 'my' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {myTasks.length}
          </span>
          {myTasks.some(t => ['ASSIGNED', 'IN_PROGRESS', 'RETURNED'].includes(t.status)) && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Có việc cần xử lý" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-2 shrink-0 ${
            activeTab === 'archived'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Lưu trữ (&gt;30 ngày)</span>
          <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${
            activeTab === 'archived' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {archivedScope === 'my' ? myArchivedCount : allArchivedCount}
          </span>
        </button>
      </div>

      {/* Info Banner when in My Tasks Tab */}
      {activeTab === 'my' && (
        <div className="space-y-3">
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-sm text-blue-950">
                  Công việc của tôi: {user?.full_name || user?.username}
                </p>
                <p className="text-blue-700 text-xs mt-0.5">
                  Chỉ hiển thị các phiếu công việc đang thực hiện hoặc mới hoàn tất gần đây. Bạn có toàn quyền <strong>Nhận việc → Bắt đầu → Cập nhật tiến độ → Gửi hoàn tất</strong>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="bg-white border border-blue-200 px-3 py-1 rounded-lg font-bold text-blue-700 text-xs shadow-2xs">
                {myTasks.length} công việc đang xử lý
              </span>
            </div>
          </div>

          {myArchivedCount > 0 && (
            <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <Archive className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>Tự động lưu trữ:</strong> Đã chuyển <strong>{myArchivedCount}</strong> công việc hoàn tất quá 30 ngày vào mục Lưu trữ để giữ màn hình làm việc luôn tập trung.
                </span>
              </div>
              <button
                onClick={() => {
                  setArchivedScope('my');
                  setActiveTab('archived');
                }}
                className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-lg text-xs transition shrink-0 cursor-pointer"
              >
                <span>Xem lưu trữ ({myArchivedCount})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Info Banner when in Archived Tab */}
      {activeTab === 'archived' && (
        <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm space-y-3 border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Kho lưu trữ công việc đã hoàn tất (&gt;30 ngày)</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    {archivedTasks.length} phiếu
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tự động lưu trữ các phiếu công việc đã hoàn tất và nghiệm thu quá 30 ngày. Dữ liệu biên bản kiểm tra, ảnh hiện trường và lịch sử xử lý vẫn được bảo toàn nguyên vẹn.
                </p>
              </div>
            </div>

            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs shrink-0 self-start sm:self-auto">
              <button
                onClick={() => setArchivedScope('my')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  archivedScope === 'my'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Của tôi ({myArchivedCount})
              </button>
              <button
                onClick={() => setArchivedScope('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  archivedScope === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tất cả ({allArchivedCount})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="flex-1 flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo mã việc, tên công việc, thiết bị, trạm, tuyến..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition cursor-pointer">
            Tìm
          </button>
        </form>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ASSIGNED">Đã giao</option>
              <option value="ACCEPTED">Đã nhận</option>
              <option value="IN_PROGRESS">Đang thực hiện</option>
              <option value="PENDING_APPROVAL">Chờ xác nhận</option>
              <option value="COMPLETED">Hoàn tất</option>
              <option value="RETURNED">Yêu cầu làm lại / Trả lại</option>
              <option value="PAUSED">Tạm dừng</option>
              <option value="OVERDUE">Quá hạn</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Tất cả mức ưu tiên</option>
            <option value="URGENT">Khẩn cấp</option>
            <option value="HIGH">Cao</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="LOW">Thấp</option>
          </select>
        </div>
      </div>

      {/* Color Status Legend Bar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-slate-100/70 border border-slate-200 rounded-xl text-[11px] text-slate-600">
        <span className="font-bold text-slate-700 mr-1 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-500"></span>
          Quy ước màu:
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Hoàn tất (Xanh lá)
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span> Đang thực hiện (Xanh dương)
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-purple-500"></span> Chờ xác nhận (Tím)
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Đã giao (Chàm)
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-cyan-500"></span> Đã nhận (Xanh ngọc)
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-orange-500"></span> Yêu cầu làm lại (Cam)
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-rose-500"></span> Quá hạn (Đỏ)
        </span>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">Đang tải danh sách công việc...</div>
      ) : currentList.length === 0 ? (
        <div className="py-12 bg-white rounded-2xl border border-slate-200 text-center space-y-3 p-6">
          {activeTab === 'archived' ? (
            <>
              <Archive className="w-12 h-12 text-slate-400 mx-auto" />
              <p className="text-slate-800 font-bold text-base">
                Chưa có công việc nào trong kho lưu trữ
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Các phiếu công việc sau khi hoàn tất và nghiệm thu quá 30 ngày sẽ tự động được chuyển về đây để lưu giữ lâu dài.
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="text-slate-800 font-bold text-base">
                {activeTab === 'my'
                  ? 'Bạn hiện không có công việc nào đang chờ thực hiện'
                  : 'Không tìm thấy công việc nào'}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {activeTab === 'my'
                  ? `Khi người quản lý giao việc cho bạn (${user?.full_name || user?.username}), phiếu công tác sẽ lập tức xuất hiện tại đây để bạn tiếp nhận và thực hiện.`
                  : 'Hãy tạo mới công việc hoặc điều chỉnh bộ lọc tìm kiếm.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {(currentList || []).map((t) => {
            const isAssignee = checkIsAssignee(t);
            const isCreator = checkIsCreator(t);
            const isSupervisor = checkIsSupervisor();
            const prog = t.progress || 0;

            return (
              <div
                key={t.id}
                className={`p-5 rounded-2xl transition duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4 ${getTaskRowStyle(
                  t.status,
                  t.is_archived
                )}`}
              >
                {/* Left details */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-700 bg-white/90 px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                      {t.task_code}
                    </span>
                    {getPriorityBadge(t.priority)}
                    {getStatusBadge(t.status, t.is_archived, t.days_since_completed)}
                    {isAssignee ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1 shadow-2xs">
                        <UserCheck className="w-3 h-3" />
                        <span>Giao cho bạn</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/80 text-slate-600 border border-slate-200 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>Chỉ xem</span>
                      </span>
                    )}
                  </div>

                  <h3
                    onClick={() => openTaskDetail(t.id)}
                    className="text-base font-bold text-slate-900 hover:text-blue-600 transition cursor-pointer"
                  >
                    {t.title}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs text-slate-600">
                    <div className="flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>
                        Thực hiện: <strong>{t.assigned_to_fullname || t.assigned_to_username || 'Chưa gán'}</strong>
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Người giao: <strong>{t.creator_fullname || t.created_by || 'Hệ thống'}</strong>
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Hạn: {formatDate(t.due_date)}</span>
                    </div>

                    {t.device_name && (
                      <div className="flex items-center space-x-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">TB: {t.device_code} - {t.device_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full max-w-md pt-1">
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-1">
                      <span>Tiến độ thực hiện</span>
                      <strong className="text-slate-800">{prog}%</strong>
                    </div>
                    <div className="w-full bg-white/80 rounded-full h-2 overflow-hidden border border-slate-200 shadow-2xs">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          t.status === 'COMPLETED'
                            ? 'bg-emerald-500'
                            : t.status === 'PENDING_APPROVAL'
                            ? 'bg-purple-500'
                            : t.status === 'IN_PROGRESS'
                            ? 'bg-blue-500'
                            : t.status === 'ACCEPTED'
                            ? 'bg-cyan-500'
                            : t.status === 'ASSIGNED'
                            ? 'bg-indigo-500'
                            : t.status === 'RETURNED' || t.status === 'REJECTED'
                            ? 'bg-orange-500'
                            : t.status === 'OVERDUE'
                            ? 'bg-rose-500'
                            : 'bg-slate-400'
                        }`}
                        style={{ width: `${prog}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions Right Column */}
                <div className="flex flex-wrap items-center space-x-2 pt-3 md:pt-0 border-t md:border-t-0 border-slate-200/60 justify-end gap-1.5 shrink-0">
                  {/* Actions for ASSIGNED PERSON ONLY */}
                  {isAssignee && (
                    <>
                      {t.status === 'ASSIGNED' && (
                        <>
                          <button
                            onClick={() => handleAcceptTask(t.id)}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 cursor-pointer shadow-2xs transition"
                          >
                            Tiếp nhận
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTask(t);
                              setShowReturnModal(true);
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg hover:bg-orange-100 hover:text-orange-800 cursor-pointer transition"
                          >
                            Từ chối nhận
                          </button>
                        </>
                      )}

                      {t.status === 'ACCEPTED' && (
                        <button
                          onClick={() => handleStartTask(t.id)}
                          className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 cursor-pointer shadow-2xs transition flex items-center space-x-1"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Bắt đầu làm</span>
                        </button>
                      )}

                      {(t.status === 'IN_PROGRESS' || t.status === 'RETURNED') && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedTask(t);
                              setProgressInput(t.progress || 50);
                              setProgressNotes('');
                              setShowProgressModal(true);
                            }}
                            className="px-2.5 py-1.5 bg-sky-50 text-sky-800 border border-sky-200 text-xs font-semibold rounded-lg hover:bg-sky-100 cursor-pointer transition flex items-center space-x-1"
                          >
                            <Sliders className="w-3.5 h-3.5 text-sky-600" />
                            <span>Tiến độ</span>
                          </button>

                          <button
                            onClick={() => openTaskDetail(t.id)}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 cursor-pointer shadow-2xs transition flex items-center space-x-1"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                            <span>Kiểm tra & Hoàn tất</span>
                          </button>
                        </>
                      )}

                      {t.status === 'PAUSED' && (
                        <button
                          onClick={() => handleResumeTask(t.id)}
                          className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 cursor-pointer transition"
                        >
                          Tiếp tục
                        </button>
                      )}
                    </>
                  )}

                  {/* Actions for CAN_BO_PHUONG_THUC / ADMIN when PENDING_APPROVAL */}
                  {t.status === 'PENDING_APPROVAL' && canApproveTask && (
                    <button
                      onClick={() => {
                        setSelectedTask(t);
                        setApprovalNotesInput('');
                        setShowApproveModal(true);
                      }}
                      className="px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 cursor-pointer shadow-2xs transition flex items-center space-x-1"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>Xác nhận hoàn thành</span>
                    </button>
                  )}

                  {/* View details button for all */}
                  <button
                    onClick={() => openTaskDetail(t.id)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition cursor-pointer flex items-center space-x-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem</span>
                  </button>

                  {(canCreateTask || isCreator) && (
                    <button
                      onClick={() => handleDeleteTask(t.id)}
                      title="Xóa công việc"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE NEW TASK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden border border-slate-100 my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">Giao việc kiểm tra & Vận hành thiết bị</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên công việc / Phiếu công tác <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="VD: Kiểm tra định kỳ Recloser REC-01 & Máy biến áp T1..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* DEVICE SELECTION MODE */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Phạm vi thiết bị thực hiện:
                  </label>
                  <div className="flex items-center space-x-1 bg-white p-1 rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setFormDeviceSelectionMode('multiple')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition ${
                        formDeviceSelectionMode === 'multiple'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Nhiều thiết bị ({formSelectedDeviceIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormDeviceSelectionMode('single')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition ${
                        formDeviceSelectionMode === 'single'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      1 Thiết bị
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormDeviceSelectionMode('none')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition ${
                        formDeviceSelectionMode === 'none'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Không gắn thiết bị
                    </button>
                  </div>
                </div>

                {/* MULTIPLE DEVICES SELECTOR */}
                {formDeviceSelectionMode === 'multiple' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Lọc tên/mã/trụ..."
                          value={deviceSearch}
                          onChange={(e) => setDeviceSearch(e.target.value)}
                          className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>

                      <select
                        value={deviceFilterFeeder}
                        onChange={(e) => setDeviceFilterFeeder(e.target.value)}
                        className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5"
                      >
                        <option value="">Tất cả phát tuyến</option>
                        {Array.from(new Set(devices.map((d) => d.feeder_name).filter(Boolean))).map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>

                      <select
                        value={deviceFilterType}
                        onChange={(e) => setDeviceFilterType(e.target.value)}
                        className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5"
                      >
                        <option value="">Tất cả loại TB</option>
                        {Array.from(new Set(devices.map((d) => d.device_type).filter(Boolean))).map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600 px-1">
                      <span>Hiển thị <strong>{filteredModalDevices.length}</strong> thiết bị</span>
                      <div className="space-x-2">
                        <button
                          type="button"
                          onClick={handleSelectAllFilteredDevices}
                          className="text-blue-600 hover:underline font-medium cursor-pointer"
                        >
                          Chọn tất cả ({filteredModalDevices.length})
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={handleDeselectAllFilteredDevices}
                          className="text-slate-500 hover:underline cursor-pointer"
                        >
                          Bỏ chọn mục lọc
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={handleClearAllSelectedDevices}
                          className="text-red-500 hover:underline cursor-pointer"
                        >
                          Xóa hết
                        </button>
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 p-1">
                      {filteredModalDevices.length === 0 ? (
                        <p className="p-3 text-xs text-slate-400 text-center">Không tìm thấy thiết bị phù hợp bộ lọc.</p>
                      ) : (
                        filteredModalDevices.map((d) => {
                          const isSelected = formSelectedDeviceIds.includes(d.id);
                          return (
                            <div
                              key={d.id}
                              onClick={() => toggleDeviceSelect(d.id)}
                              className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition text-xs ${
                                isSelected ? 'bg-blue-50/70 text-blue-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-300 shrink-0" />
                                )}
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-slate-900">{d.device_id}</span>
                                    <span>- {d.name}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                    <span>Vị trí: <strong>{d.pole_number || 'Chưa có số trụ'}</strong></span>
                                    <span>•</span>
                                    <span>Tuyến: <strong>{d.feeder_name || 'N/A'}</strong></span>
                                  </div>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 shrink-0">
                                {d.device_type}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* SINGLE DEVICE SELECTOR */}
                {formDeviceSelectionMode === 'single' && (
                  <div>
                    <select
                      value={formDeviceId}
                      onChange={(e) => setFormDeviceId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">-- Chọn 1 thiết bị --</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.device_id} - {d.name} ({d.device_type}) - Tuyến {d.feeder_name || 'N/A'} - Trụ {d.pole_number || 'N/A'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mẫu Checklist kiểm tra kèm theo</label>
                  <select
                    value={formChecklistId}
                    onChange={(e) => setFormChecklistId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">-- Không đính kèm checklist --</option>
                    {checklists.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.checklist_code}: {c.title} ({c.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Người thực hiện được chỉ định <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formAssignedUserId}
                    required
                    onChange={(e) => {
                      setFormAssignedUserId(e.target.value);
                      const selectedUser = usersList.find((u) => String(u.id) === e.target.value);
                      if (selectedUser?.team) {
                        setFormTeam(selectedUser.team);
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  >
                    <option value="">-- Chọn nhân viên thực hiện --</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.username}) - {u.team || u.unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mức độ ưu tiên</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="LOW">Thấp</option>
                    <option value="MEDIUM">Trung bình</option>
                    <option value="HIGH">Cao</option>
                    <option value="URGENT">Khẩn cấp</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đội/Đơn vị phụ trách</label>
                  <input
                    type="text"
                    value={formTeam}
                    onChange={(e) => setFormTeam(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hạn hoàn thành <span className="text-red-500">*</span></label>
                  <input
                    type="datetime-local"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung chi tiết công việc <span className="text-red-500">*</span></label>
                <textarea
                  rows={3}
                  required
                  placeholder="Nêu rõ yêu cầu công việc, các hạng mục cần thao tác, lưu ý an toàn..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú bổ sung</label>
                <input
                  type="text"
                  placeholder="Ghi chú thêm nếu có..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition"
                >
                  {submitting ? 'Đang xử lý...' : 'Xác nhận giao việc'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK DETAIL & WORKFLOW MODAL */}
      {showDetailModal && selectedTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden border border-slate-100 my-8">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="font-mono text-xs font-bold text-blue-300 bg-blue-900/80 px-2 py-0.5 rounded border border-blue-700">
                  {selectedTask.task_code}
                </span>
                <h3 className="font-bold text-base line-clamp-1">{selectedTask.title}</h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Workflow Step Bar */}
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
              <div className="flex items-center justify-between max-w-2xl mx-auto text-[11px] font-bold">
                <div className={`flex items-center gap-1.5 ${
                  ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED'].includes(selectedTask.status)
                    ? 'text-blue-700' : 'text-slate-400'
                }`}>
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</div>
                  <span>Đã giao</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300" />

                <div className={`flex items-center gap-1.5 ${
                  ['ACCEPTED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED'].includes(selectedTask.status)
                    ? 'text-cyan-700 font-bold' : 'text-slate-400'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    ['ACCEPTED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED'].includes(selectedTask.status)
                      ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>2</div>
                  <span>Đã nhận</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300" />

                <div className={`flex items-center gap-1.5 ${
                  ['IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED'].includes(selectedTask.status)
                    ? 'text-amber-700 font-bold' : 'text-slate-400'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    ['IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED'].includes(selectedTask.status)
                      ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>3</div>
                  <span>Đang làm</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300" />

                <div className={`flex items-center gap-1.5 ${
                  ['PENDING_APPROVAL', 'COMPLETED'].includes(selectedTask.status)
                    ? 'text-purple-700 font-bold' : 'text-slate-400'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    ['PENDING_APPROVAL', 'COMPLETED'].includes(selectedTask.status)
                      ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>4</div>
                  <span>Chờ xác nhận</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300" />

                <div className={`flex items-center gap-1.5 ${
                  selectedTask.status === 'COMPLETED' ? 'text-emerald-700 font-bold' : 'text-slate-400'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    selectedTask.status === 'COMPLETED' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>5</div>
                  <span>Hoàn tất</span>
                </div>
              </div>
            </div>

            {/* Modal Navigation Sub-tabs */}
            <div className="flex border-b border-slate-200 px-6 pt-2 bg-white space-x-6">
              <button
                type="button"
                onClick={() => setDetailActiveTab('content')}
                className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  detailActiveTab === 'content'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Nội dung & Checklist</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailActiveTab('history')}
                className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  detailActiveTab === 'history'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Lịch sử thao tác ({selectedTask.history?.length || 0})</span>
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Permission & Identity Notification Alert */}
              {checkIsAssignee(selectedTask) ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    <strong>Bạn là người được giao thực hiện công việc này.</strong> Hãy cập nhật tiến độ và hoàn thành các mục kiểm tra trước hạn quy định.
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Chế độ chỉ xem:</strong> Công việc này được giao cho <strong>{selectedTask.assigned_to_fullname || selectedTask.assigned_to_username}</strong>. Theo nguyên tắc bảo mật “Giao cho ai – chỉ người đó được thực hiện”, bạn chỉ có quyền theo dõi.
                  </span>
                </div>
              )}

              {/* Status Banner when PENDING_APPROVAL */}
              {selectedTask.status === 'PENDING_APPROVAL' && (
                <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between gap-3 text-xs text-purple-900 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>
                      <strong>Đang chờ xác nhận hoàn thành:</strong> Người thực hiện đã gửi kết quả. Người giao việc ({selectedTask.creator_fullname || selectedTask.created_by}) hoặc cấp quản lý cần kiểm tra và bấm <strong>"Xác nhận hoàn thành"</strong> để kết thúc công tác.
                    </span>
                  </div>
                </div>
              )}

              {/* Comprehensive Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <p className="text-slate-500">Trạng thái:</p>
                  <div className="mt-1">{getStatusBadge(selectedTask.status, selectedTask.is_archived, selectedTask.days_since_completed)}</div>
                </div>

                <div>
                  <p className="text-slate-500">Mức độ ưu tiên:</p>
                  <div className="mt-1">{getPriorityBadge(selectedTask.priority)}</div>
                </div>

                <div>
                  <p className="text-slate-500">Người giao việc:</p>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {selectedTask.creator_fullname || selectedTask.created_by || 'Hệ thống'}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Người thực hiện:</p>
                  <p className="font-bold text-blue-900 mt-0.5">
                    {selectedTask.assigned_to_fullname || 'Chưa gán'} ({selectedTask.team})
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Ngày giao việc:</p>
                  <p className="font-semibold text-slate-800 mt-0.5 font-mono text-xs">
                    {selectedTask.assigned_date ? formatDateTime(selectedTask.assigned_date) : 'N/A'}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Hạn hoàn thành:</p>
                  <p className="font-semibold text-red-700 mt-0.5 font-mono text-xs">
                    {formatDateTime(selectedTask.due_date)}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Tiến độ thực tế:</p>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {selectedTask.progress || 0}%
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Thiết bị liên quan:</p>
                  <p className="font-bold text-slate-900 mt-0.5 truncate">
                    {selectedTask.device_code ? `${selectedTask.device_code} - ${selectedTask.device_name}` : 'Không gắn TB'}
                  </p>
                </div>

                {/* Detailed Execution Timestamps */}
                {selectedTask.accepted_at && (
                  <div>
                    <p className="text-slate-500">Thời gian nhận việc:</p>
                    <p className="font-semibold text-slate-800 mt-0.5 font-mono text-xs">
                      {formatDateTime(selectedTask.accepted_at)}
                    </p>
                  </div>
                )}

                {selectedTask.started_at && (
                  <div>
                    <p className="text-slate-500">Thời gian bắt đầu:</p>
                    <p className="font-semibold text-slate-800 mt-0.5 font-mono text-xs">
                      {formatDateTime(selectedTask.started_at)}
                    </p>
                  </div>
                )}

                {selectedTask.submitted_at && (
                  <div>
                    <p className="text-slate-500">Thời gian gửi hoàn tất:</p>
                    <p className="font-semibold text-purple-800 mt-0.5 font-mono text-xs">
                      {formatDateTime(selectedTask.submitted_at)}
                    </p>
                  </div>
                )}

                {selectedTask.completed_at && (
                  <div>
                    <p className="text-slate-500">Thời gian xác nhận hoàn tất:</p>
                    <p className="font-semibold text-emerald-800 mt-0.5 font-mono text-xs">
                      {formatDateTime(selectedTask.completed_at)} (bởi {selectedTask.approved_by_fullname || selectedTask.completed_by})
                    </p>
                  </div>
                )}
              </div>

              {/* TAB 1: Content & Checklist */}
              {detailActiveTab === 'content' && (
                <div className="space-y-4">
                  {/* Task Content */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nội dung chi tiết công việc:</h4>
                    <p className="text-sm text-slate-800 bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/60 leading-relaxed whitespace-pre-wrap">
                      {selectedTask.content}
                    </p>
                  </div>

                  {selectedTask.notes && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Ghi chú bổ sung:</h4>
                      <p className="text-xs text-slate-600 italic bg-slate-100 p-2.5 rounded-lg">{selectedTask.notes}</p>
                    </div>
                  )}

                  {selectedTask.return_reason && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                      <h4 className="text-xs font-bold text-orange-900 mb-0.5">Lý do yêu cầu làm lại / Trả lại:</h4>
                      <p className="text-xs text-orange-800">{selectedTask.return_reason}</p>
                    </div>
                  )}

                  {selectedTask.approval_notes && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <h4 className="text-xs font-bold text-emerald-900 mb-0.5">Đánh giá nghiệm thu:</h4>
                      <p className="text-xs text-emerald-800">{selectedTask.approval_notes}</p>
                    </div>
                  )}

                  {/* CHECKLIST ITEMS & RESULTS */}
                  {selectedTask.task_devices && selectedTask.task_devices.length > 0 ? (
                    <div className="space-y-6 pt-2">
                      {(selectedTask.task_devices || []).map((td: any) => (
                        <div key={td.id} className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                              <FileCheck2 className="w-4 h-4 text-blue-600" />
                              <span>Checklist: {td.device_name} ({td.checklist_title || 'Chưa gắn mẫu'})</span>
                            </h4>
                            <div className="flex items-center space-x-3">
                              <button
                                type="button"
                                onClick={() => setPrintDeviceChecklist(td)}
                                className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold text-xs rounded-lg transition"
                              >
                                <Printer className="w-4 h-4" />
                                <span>In Biên bản</span>
                              </button>
                              <span className="text-xs text-slate-500 font-medium">
                                {td.checklist_items?.length || 0} tiêu chuẩn
                              </span>
                            </div>
                          </div>

                          {td.checklist_items && td.checklist_items.length > 0 && (
                            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
                              {(td.checklist_items || []).map((item: any) => {
                                const resKey = `${td.device_id}_${item.id}`;
                                const resVal = itemResults[resKey] || { result_value: '', is_pass: true, notes: '' };
                                const isEditable = checkIsAssignee(selectedTask) && ['IN_PROGRESS', 'ACCEPTED', 'RETURNED'].includes(selectedTask.status);
                                return (
                                  <div key={item.id} className="p-3.5 bg-white hover:bg-slate-50/50 transition space-y-2">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="space-y-0.5">
                                        <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                          #{item.item_order} [{item.item_code}]
                                        </span>
                                        <p className="text-sm font-medium text-slate-900">{item.content}</p>
                                        {item.standard_value && (
                                          <p className="text-xs text-slate-500">
                                            Tiêu chuẩn: <strong className="text-emerald-700">{item.standard_value}</strong>
                                          </p>
                                        )}
                                      </div>

                                      {/* Inputs for Assigned Employee */}
                                      {isEditable ? (
                                        <div className="flex items-center space-x-2 shrink-0">
      
                                    {item.input_type === 'OPTION' && (() => {
                                      let opts: string[] = [];
                                      try {
                                        opts = item.options_json ? JSON.parse(item.options_json) : [];
                                      } catch(e) {}
                                      return (
                                        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
                                          {opts.map((opt: string) => (
                                            <button
                                              key={opt}
                                              type="button"
                                              onClick={() =>
                                                setItemResults(prev => ({
                                                  ...prev,
                                                  [resKey]: { ...prev[resKey], is_pass: true, result_value: opt }
                                                }))
                                              }
                                              className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                                                resVal.result_value === opt
                                                  ? 'bg-blue-600 text-white shadow-xs'
                                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                              }`}
                                            >
                                              {opt}
                                            </button>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                    {item.input_type === 'PASS_FAIL' && (
                                            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setItemResults(prev => ({
                                                    ...prev,
                                                    [resKey]: { ...prev[resKey], is_pass: true, result_value: 'ĐẠT' }
                                                  }))
                                                }
                                                className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                                                  resVal.is_pass
                                                    ? 'bg-emerald-600 text-white shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'
                                                }`}
                                              >
                                                ĐẠT
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setItemResults(prev => ({
                                                    ...prev,
                                                    [resKey]: { ...prev[resKey], is_pass: false, result_value: 'KHÔNG ĐẠT' }
                                                  }))
                                                }
                                                className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                                                  !resVal.is_pass
                                                    ? 'bg-red-600 text-white shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'
                                                }`}
                                              >
                                                K.ĐẠT
                                              </button>
                                            </div>
                                          )}
                                          {item.input_type === 'NUMBER' && (
                                            <div className="flex items-center space-x-1">
                                              <input
                                                type="text"
                                                placeholder="Giá trị"
                                                value={resVal.result_value}
                                                onChange={(e) =>
                                                  setItemResults(prev => ({
                                                    ...prev,
                                                    [resKey]: { ...prev[resKey], result_value: e.target.value }
                                                  }))
                                                }
                                                className="w-24 px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                                              />
                                              <span className="text-xs text-slate-500 font-medium">{item.unit}</span>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="text-right">
                                          <span
                                            className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                                              resVal.is_pass
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-red-100 text-red-800'
                                            }`}
                                          >
                                            {resVal.result_value || (resVal.is_pass ? 'ĐẠT' : 'KHÔNG ĐẠT')}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    {isEditable ? (
                                      <input
                                        type="text"
                                        placeholder="Ghi chú kết quả thực tế..."
                                        value={resVal.notes}
                                        onChange={(e) =>
                                          setItemResults(prev => ({
                                            ...prev,
                                            [resKey]: { ...prev[resKey], notes: e.target.value }
                                          }))
                                        }
                                        className="w-full text-xs px-2.5 py-1 border border-slate-200 rounded bg-slate-50/50"
                                      />
                                    ) : resVal.notes ? (
                                      <p className="text-xs text-slate-500 italic">Ghi chú: {resVal.notes}</p>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : selectedTask.checklist_items && selectedTask.checklist_items.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                          <FileCheck2 className="w-4 h-4 text-blue-600" />
                          <span>Phiếu Checklist Kiểm tra ({selectedTask.checklist_title})</span>
                        </h4>
                        <div className="flex items-center space-x-3">
                          <button
                            type="button"
                            onClick={() => setPrintDeviceChecklist(selectedTask)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold text-xs rounded-lg transition"
                          >
                            <Printer className="w-4 h-4" />
                            <span>In Biên bản</span>
                          </button>
                          <span className="text-xs text-slate-500 font-medium">
                            {selectedTask.checklist_items?.length || 0} tiêu chuẩn
                          </span>
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
                        {(selectedTask.checklist_items || []).map((item: any) => {
                          const resKeyLegacy = `legacy_${item.id}`;
                          const resVal = itemResults[`legacy_${item.id}`] || { result_value: '', is_pass: true, notes: '' };
                          const isEditable = checkIsAssignee(selectedTask) && ['IN_PROGRESS', 'ACCEPTED', 'RETURNED'].includes(selectedTask.status);

                          return (
                            <div key={item.id} className="p-3.5 bg-white hover:bg-slate-50/50 transition space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-0.5">
                                  <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    #{item.item_order} [{item.item_code}]
                                  </span>
                                  <p className="text-sm font-medium text-slate-900">{item.content}</p>
                                  {item.standard_value && (
                                    <p className="text-xs text-slate-500">
                                      Tiêu chuẩn: <strong className="text-emerald-700">{item.standard_value}</strong>
                                    </p>
                                  )}
                                </div>

                                {/* Inputs for Assigned Employee */}
                                {isEditable ? (
                                  <div className="flex items-center space-x-2 shrink-0">
                                    {item.input_type === 'OPTION' && (() => {
                                      let opts: string[] = [];
                                      try {
                                        opts = item.options_json ? JSON.parse(item.options_json) : [];
                                      } catch(e) {}
                                      return (
                                        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
                                          {opts.map((opt: string) => (
                                            <button
                                              key={opt}
                                              type="button"
                                              onClick={() =>
                                                setItemResults(prev => ({
                                                  ...prev,
                                                  [resKeyLegacy]: { ...prev[resKeyLegacy], is_pass: true, result_value: opt }
                                                }))
                                              }
                                              className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                                                resVal.result_value === opt
                                                  ? 'bg-blue-600 text-white shadow-xs'
                                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                              }`}
                                            >
                                              {opt}
                                            </button>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                    {item.input_type === 'PASS_FAIL' && (
                                      <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setItemResults(prev => ({
                                              ...prev,
                                              [item.id]: { ...prev[item.id], is_pass: true, result_value: 'ĐẠT' }
                                            }))
                                          }
                                          className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                                            resVal.is_pass
                                              ? 'bg-emerald-600 text-white shadow-xs'
                                              : 'text-slate-600 hover:text-slate-900'
                                          }`}
                                        >
                                          ĐẠT
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setItemResults(prev => ({
                                              ...prev,
                                              [item.id]: { ...prev[item.id], is_pass: false, result_value: 'KHÔNG ĐẠT' }
                                            }))
                                          }
                                          className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                                            !resVal.is_pass
                                              ? 'bg-red-600 text-white shadow-xs'
                                              : 'text-slate-600 hover:text-slate-900'
                                          }`}
                                        >
                                          K.ĐẠT
                                        </button>
                                      </div>
                                    )}

                                    {item.input_type === 'NUMBER' && (
                                      <div className="flex items-center space-x-1">
                                        <input
                                          type="text"
                                          placeholder="Giá trị"
                                          value={resVal.result_value}
                                          onChange={(e) =>
                                            setItemResults(prev => ({
                                              ...prev,
                                              [item.id]: { ...prev[item.id], result_value: e.target.value }
                                            }))
                                          }
                                          className="w-24 px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                                        />
                                        <span className="text-xs text-slate-500 font-medium">{item.unit}</span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  /* View Mode for Completed or Non-assignee */
                                  <div className="text-right">
                                    <span
                                      className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                                        resVal.is_pass
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-red-100 text-red-800'
                                      }`}
                                    >
                                      {resVal.result_value || (resVal.is_pass ? 'ĐẠT' : 'KHÔNG ĐẠT')}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {isEditable ? (
                                <input
                                  type="text"
                                  placeholder="Ghi chú kết quả thực tế..."
                                  value={resVal.notes}
                                  onChange={(e) =>
                                    setItemResults(prev => ({
                                      ...prev,
                                      [item.id]: { ...prev[item.id], notes: e.target.value }
                                    }))
                                  }
                                  className="w-full text-xs px-2.5 py-1 border border-slate-200 rounded bg-slate-50/50"
                                />
                              ) : resVal.notes ? (
                                <p className="text-xs text-slate-500 italic">Ghi chú: {resVal.notes}</p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Audit History / Logs */}
              {detailActiveTab === 'history' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Lịch sử thao tác & Tiến trình công việc:
                  </h4>
                  {selectedTask.history && selectedTask.history.length > 0 ? (
                    <div className="relative border-l-2 border-blue-200 ml-4 space-y-4 pl-4 py-2">
                      {(selectedTask.history || []).map((h: TaskHistory) => (
                        <div key={h.id} className="relative group">
                          <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white ring-2 ring-blue-100" />
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {h.action_label || h.action}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1" title={formatDateTime(h.created_at)}>
                                <Clock className="w-2.5 h-2.5 text-blue-500" />
                                {formatDateTime(h.created_at)} ({formatRelativeTime(h.created_at)})
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">
                              Người thực hiện: <strong>{h.user_fullname || h.username}</strong>
                              {h.progress !== null && h.progress !== undefined && (
                                <span> • Tiến độ: <strong>{h.progress}%</strong></span>
                              )}
                            </p>
                            {h.notes && (
                              <p className="text-xs text-slate-700 italic bg-white p-2 rounded-lg border border-slate-100 mt-1">
                                {h.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-6">Chưa có lịch sử thao tác.</p>
                  )}
                </div>
              )}

              {/* ACTION BUTTONS FOR TASK LIFECYCLE */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* ACTIONS FOR ASSIGNED EMPLOYEE ONLY */}
                  {checkIsAssignee(selectedTask) && (
                    <>
                      {selectedTask.status === 'ASSIGNED' && (
                        <>
                          <button
                            onClick={() => handleAcceptTask(selectedTask.id)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                          >
                            Tiếp nhận công việc
                          </button>
                          <button
                            onClick={() => setShowReturnModal(true)}
                            className="px-3 py-2 bg-slate-100 hover:bg-orange-100 text-orange-800 text-xs font-semibold rounded-xl transition"
                          >
                            Từ chối nhận
                          </button>
                        </>
                      )}

                      {selectedTask.status === 'ACCEPTED' && (
                        <button
                          onClick={() => handleStartTask(selectedTask.id)}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Bắt đầu thi công / kiểm tra</span>
                        </button>
                      )}

                      {['IN_PROGRESS', 'RETURNED'].includes(selectedTask.status) && (
                        <>
                          <button
                            onClick={() => {
                              setProgressInput(selectedTask.progress || 50);
                              setProgressNotes('');
                              setShowProgressModal(true);
                            }}
                            className="px-3 py-2 bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-bold rounded-xl transition flex items-center space-x-1"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            <span>Cập nhật tiến độ ({selectedTask.progress || 0}%)</span>
                          </button>

                          <button
                            onClick={() => setShowPauseModal(true)}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition"
                          >
                            Tạm dừng
                          </button>
                        </>
                      )}

                      {selectedTask.status === 'PAUSED' && (
                        <button
                          onClick={() => handleResumeTask(selectedTask.id)}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition"
                        >
                          Tiếp tục thực hiện
                        </button>
                      )}
                    </>
                  )}

                  {/* ACTIONS FOR CAN_BO_PHUONG_THUC / ADMIN ONLY WHEN PENDING_APPROVAL */}
                  {canApproveTask && selectedTask.status === 'PENDING_APPROVAL' && (
                    <>
                      <button
                        onClick={() => {
                          setApprovalNotesInput('');
                          setShowApproveModal(true);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Xác nhận hoàn thành (Nghiệm thu)</span>
                      </button>

                      <button
                        onClick={() => {
                          setReworkReasonInput('');
                          setShowReworkModal(true);
                        }}
                        className="px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs font-semibold rounded-xl transition"
                      >
                        Yêu cầu làm lại
                      </button>
                    </>
                  )}

                  {!canApproveTask && selectedTask.status === 'PENDING_APPROVAL' && (
                    <div className="px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-800 text-xs flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-purple-600" />
                      <span>Đang chờ Cán bộ phương thức / Admin nghiệm thu và xác nhận hoàn thành</span>
                    </div>
                  )}
                </div>

                {/* Right Side Buttons */}
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-medium hover:bg-slate-50"
                  >
                    Đóng
                  </button>

                  {/* Submit Completion button (Assignee only) */}
                  {checkIsAssignee(selectedTask) && ['IN_PROGRESS', 'ACCEPTED', 'RETURNED'].includes(selectedTask.status) && (
                    <button
                      type="button"
                      onClick={handleSubmitChecklistResults}
                      disabled={submitting}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>{submitting ? 'Đang gửi...' : 'Gửi hoàn tất (Chờ xác nhận)'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: UPDATE PROGRESS */}
      {showProgressModal && selectedTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                <span>Cập nhật tiến độ công việc</span>
              </h3>
              <button onClick={() => setShowProgressModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mức tiến độ (%): <strong className="text-blue-600 text-sm">{progressInput}%</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="99"
                  value={progressInput}
                  onChange={(e) => setProgressInput(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>99%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú công việc đã làm:</label>
                <textarea
                  rows={3}
                  placeholder="Mô tả các hạng mục đã hoàn thành hoặc tình hình hiện trường..."
                  value={progressNotes}
                  onChange={(e) => setProgressNotes(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowProgressModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveProgress}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
              >
                Lưu tiến độ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: APPROVE / CONFIRM COMPLETION */}
      {showApproveModal && selectedTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                <span>Nghiệm thu & Xác nhận hoàn tất</span>
              </h3>
              <button onClick={() => setShowApproveModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <p className="text-xs text-slate-600">
              Bạn đang xác nhận hoàn thành cho công việc <strong>{selectedTask.task_code}</strong> thực hiện bởi <strong>{selectedTask.assigned_to_fullname}</strong>. Trạng thái sẽ chuyển thành <strong>Hoàn tất</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nhận xét / Đánh giá chất lượng:</label>
              <textarea
                rows={3}
                placeholder="VD: Kiểm tra đạt yêu cầu an toàn, thông số cách điện chuẩn..."
                value={approvalNotesInput}
                onChange={(e) => setApprovalNotesInput(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleApproveTask}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
              >
                Xác nhận hoàn thành
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REJECT / REQUEST REWORK */}
      {showReworkModal && selectedTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-orange-600" />
                <span>Yêu cầu làm lại / Bổ sung</span>
              </h3>
              <button onClick={() => setShowReworkModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <p className="text-xs text-slate-600">
              Chuyển công việc về trạng thái <strong>Yêu cầu làm lại</strong> để người thực hiện tiếp tục hoàn thiện.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lý do yêu cầu làm lại / Các điểm cần bổ sung <span className="text-red-500">*</span>:
              </label>
              <textarea
                rows={3}
                required
                placeholder="Nêu rõ lý do chưa đạt, hạng mục cần kiểm tra lại..."
                value={reworkReasonInput}
                onChange={(e) => setReworkReasonInput(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowReworkModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleRejectCompletion}
                className="px-4 py-1.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs"
              >
                Gửi yêu cầu làm lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: RETURN / REFUSE TASK (Assignee only) */}
      {showReturnModal && selectedTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <span>Từ chối nhận / Trả lại công việc</span>
              </h3>
              <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lý do trả lại công việc <span className="text-red-500">*</span>:
              </label>
              <textarea
                rows={3}
                required
                placeholder="VD: Đang xử lý sự cố khẩn cấp khác, trùng ca trực, thiết bị ngoài địa bàn phụ trách..."
                value={returnReasonInput}
                onChange={(e) => setReturnReasonInput(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowReturnModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleReturnTask}
                className="px-4 py-1.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs"
              >
                Xác nhận trả lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: PAUSE TASK */}
      {showPauseModal && selectedTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Pause className="w-5 h-5 text-slate-600" />
                <span>Tạm dừng công việc</span>
              </h3>
              <button onClick={() => setShowPauseModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lý do tạm dừng:</label>
              <textarea
                rows={3}
                placeholder="VD: Chờ cắt điện phân đoạn, thời tiết mưa bão, chờ bổ sung vật tư..."
                value={pauseReasonInput}
                onChange={(e) => setPauseReasonInput(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowPauseModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handlePauseTask}
                className="px-4 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs"
              >
                Xác nhận tạm dừng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
