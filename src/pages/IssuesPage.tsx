import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ShieldAlert,
  User,
  Image as ImageIcon,
  MessageSquare,
  Eye,
  Trash2,
  ExternalLink,
  ChevronRight,
  Zap
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useDataContext } from '../context/DataContext';
import { Issue, IssueSeverity, IssueStatus, Device, User as UserType } from '../types';
import { formatDateTime, formatRelativeTime } from '../utils/dateTime';

export const IssuesPage: React.FC = () => {
  const { user } = useAuth();
  const { devices, fetchDevices } = useDataContext();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  // Modals
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Ref data
  const [usersList, setUsersList] = useState<UserType[]>([]);

  // Report Form State
  const [formDeviceId, setFormDeviceId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formSeverity, setFormSeverity] = useState<IssueSeverity>('MEDIUM');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Resolution Form State
  const [updateStatus, setUpdateStatus] = useState<IssueStatus>('IN_PROGRESS');
  const [assignUser, setAssignUser] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    loadIssues();
    loadRefData();
  }, [statusFilter, severityFilter]);

  const loadIssues = async () => {
    setLoading(true);
    try {
      const res = await api.getIssues({
        search: searchTerm,
        status: statusFilter,
        severity: severityFilter,
        limit: 50
      });
      if (res.success) {
        setIssues(res.data);
        setNextCursor(res.nextCursor || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadRefData = async () => {
    try {
      fetchDevices();
      const userRes = await api.getUsers();
      if (userRes.success) {
        setUsersList(userRes.data.filter((u: UserType) => 
          u.status === 'ACTIVE' && 
          u.roles?.some(r => ['STAFF', 'NHAN_VIEN_VAN_HANH', 'FIELD_OPERATOR'].includes(r))
        ));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDeviceId || !formTitle || !formContent) {
      alert('Vui lòng chọn Thiết bị, Tên bất thường và Nội dung.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.reportIssue({
        device_id: formDeviceId ? formDeviceId : null,
        title: formTitle,
        content: formContent,
        severity: formSeverity,
        image_url: formImageUrl,
        notes: formNotes
      });

      if (res.success) {
        alert('Ghi nhận báo bất thường thành công!');
        setShowReportModal(false);
        resetReportForm();
        loadIssues();
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi khi báo bất thường');
    } finally {
      setSubmitting(false);
    }
  };

  const resetReportForm = () => {
    setFormDeviceId('');
    setFormTitle('');
    setFormContent('');
    setFormSeverity('MEDIUM');
    setFormImageUrl('');
    setFormNotes('');
  };

  const handleUpdateStatus = async (issueId: number) => {
    try {
      const res = await api.updateIssueStatus(issueId, {
        status: updateStatus,
        assigned_to_username: assignUser || undefined,
        resolution_notes: resolutionNotes
      });

      if (res.success) {
        alert('Cập nhật tiến độ xử lý thành công!');
        setShowDetailModal(false);
        loadIssues();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteIssue = async (id: number) => {
    if (!confirm('Xóa ghi nhận bất thường này?')) return;
    try {
      const res = await api.deleteIssue(id);
      if (res.success) loadIssues();
    } catch (e: any) {
      alert(e.message);
    }
  };

  
  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await api.getIssues({
        search: searchTerm,
        status: statusFilter,
        severity: severityFilter,
        limit: 50,
        lastDocId: nextCursor
      });
      if (res.success) {
        setIssues(prev => [...prev, ...res.data]);
        setNextCursor(res.nextCursor || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  };

  const getSeverityBadge = (s: IssueSeverity) => {
    switch (s) {
      case 'CRITICAL':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-600 text-white animate-pulse">NGUY CẤP</span>;
      case 'HIGH':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-orange-600 text-white">NẶNG (MỨC 2)</span>;
      case 'MEDIUM':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-500 text-white">TRUNG BÌNH</span>;
      case 'LOW':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-500 text-white">NHẸ (MỨC 1)</span>;
    }
  };

  const getStatusBadge = (st: IssueStatus) => {
    switch (st) {
      case 'NEW':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-200">Mới phát hiện</span>;
      case 'ASSIGNED':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">Đã phân công</span>;
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">Đang xử lý</span>;
      case 'RESOLVED':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Đã khắc phục</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 border border-gray-200">Đã đóng</span>;
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-amber-600 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4" />
            <span>An toàn Vận hành & Quản lý Khiếm khuyết</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Quản lý Bất thường & Khiếm khuyết</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Ghi nhận hiện tượng phát nhiệt, hư hỏng thiết bị, cảnh báo mất kết nối SCADA và theo dõi tiến độ khắc phục.
          </p>
        </div>

        <button
          onClick={() => setShowReportModal(true)}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm rounded-xl shadow-sm transition space-x-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Báo bất thường</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form onSubmit={(e) => { e.preventDefault(); loadIssues(); }} className="flex-1 flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm mã bất thường, tên, thiết bị..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition">
            Tìm
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-600">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
            >
              <option value="">Tất cả</option>
              <option value="NEW">Mới phát hiện</option>
              <option value="ASSIGNED">Đã phân công</option>
              <option value="IN_PROGRESS">Đang xử lý</option>
              <option value="RESOLVED">Đã khắc phục</option>
              <option value="CLOSED">Đã đóng</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-600">Cấp độ:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
            >
              <option value="">Tất cả</option>
              <option value="CRITICAL">NGUY CẤP</option>
              <option value="HIGH">NẶNG</option>
              <option value="MEDIUM">TRUNG BÌNH</option>
              <option value="LOW">NHẸ</option>
            </select>
          </div>
        </div>
      </div>

      {/* ISSUES LIST */}
      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">Đang tải danh sách khiếm khuyết...</div>
      ) : issues.length === 0 ? (
        <div className="py-12 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <p className="text-slate-700 font-medium text-base">Tuyệt vời! Không có bất thường nào chưa xử lý</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {issues.map((item) => (
            <div
              key={item.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {item.issue_code}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    {getSeverityBadge(item.severity)}
                    {getStatusBadge(item.status)}
                  </div>
                </div>

                <h3
                  onClick={() => {
                    setSelectedIssue(item);
                    setUpdateStatus(item.status);
                    setAssignUser(item.assigned_to_username || '');
                    setResolutionNotes(item.resolution_notes || '');
                    setShowDetailModal(true);
                  }}
                  className="font-bold text-base text-slate-900 hover:text-amber-600 cursor-pointer transition line-clamp-1"
                >
                  {item.title}
                </h3>

                <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {item.content}
                </p>

                <div className="text-xs text-slate-500 space-y-1">
                  <p>Thiết bị: <strong className="text-slate-800">{item.device_code}</strong> ({item.device_name})</p>
                  <p>Người báo: <strong className="text-slate-800">{item.reported_by_fullname}</strong> <span className="font-mono text-slate-400 font-semibold" title={formatDateTime(item.reported_at)}>({formatDateTime(item.reported_at)} - {formatRelativeTime(item.reported_at)})</span></p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Phụ trách: <strong className="text-slate-800">{item.assigned_to_fullname || 'Chưa gán'}</strong>
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setSelectedIssue(item);
                      setUpdateStatus(item.status);
                      setAssignUser(item.assigned_to_username || '');
                      setResolutionNotes(item.resolution_notes || '');
                      setShowDetailModal(true);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition"
                  >
                    Xem & Xử lý
                  </button>

                  {user?.roles?.includes('ADMIN') && (
                    <button
                      onClick={() => handleDeleteIssue(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REPORT ISSUE MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-100 my-8">
            <div className="px-6 py-4 bg-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-200" />
                <h3 className="font-bold text-base">Ghi nhận Bất thường / Khiếm khuyết</h3>
              </div>
              <button onClick={() => setShowReportModal(false)} className="text-white">✕</button>
            </div>

            <form onSubmit={handleReportIssue} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chọn thiết bị bị ảnh hưởng <span className="text-red-500">*</span></label>
                <select
                  required
                  value={formDeviceId}
                  onChange={(e) => setFormDeviceId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="">-- Chọn thiết bị --</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.device_id} - {d.name} ({d.device_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên / Tóm tắt khiếm khuyết <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Phát nhiệt má dao tiếp xúc LBS 471-01 Trụ 12"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mức độ nghiêm trọng <span className="text-red-500">*</span></label>
                <select
                  value={formSeverity}
                  onChange={(e) => setFormSeverity(e.target.value as IssueSeverity)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-bold"
                >
                  <option value="LOW">Nhẹ (Mức 1 - Theo dõi định kỳ)</option>
                  <option value="MEDIUM">Trung bình (Mức 2 - Cần đăng ký phương thức xử lý)</option>
                  <option value="HIGH">Nặng (Cần xử lý trong tuần - Cảnh báo lãnh đạo)</option>
                  <option value="CRITICAL">NGUY CẤP (Xử lý ngay lập tức - Báo động khẩn)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả hiện tượng chi tiết <span className="text-red-500">*</span></label>
                <textarea
                  rows={3}
                  required
                  placeholder="Mô tả kết quả đo camera nhiệt, thông số dòng áp, tiếng kêu lạ hoặc hiện tượng mất kết nối..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Link Ảnh chụp hiện trường</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-sm font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl shadow-sm transition"
                >
                  Ghi nhận bất thường
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL & STATUS UPDATE MODAL */}
      {showDetailModal && selectedIssue && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-100">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-amber-400">{selectedIssue.issue_code}</span>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <h3 className="font-bold text-lg text-slate-900">{selectedIssue.title}</h3>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
                {selectedIssue.content}
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cập nhật Trạng thái xử lý</label>
                  <select
                    value={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.value as IssueStatus)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="NEW">Mới phát hiện</option>
                    <option value="ASSIGNED">Đã phân công</option>
                    <option value="IN_PROGRESS">Đang xử lý</option>
                    <option value="RESOLVED">Đã khắc phục</option>
                    <option value="CLOSED">Đóng bất thường</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phân công người xử lý</label>
                  <select
                    value={assignUser}
                    onChange={(e) => setAssignUser(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">-- Chưa chọn --</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.username}>
                        {u.full_name} ({u.username})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Biện pháp & Biên bản khắc phục</label>
                <textarea
                  rows={3}
                  placeholder="Ghi rõ phương thức xử lý (đã tách lèo, xiết bu lông, thay modem SCADA...)"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-medium"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(selectedIssue.id)}
                  className="px-5 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  Lưu cập nhật
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
