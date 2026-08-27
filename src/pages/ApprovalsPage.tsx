import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  PlusCircle,
  RefreshCw,
  MapPin,
  Activity,
  Trash2,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Check,
  Building2,
  Calendar,
  User,
  Zap,
  Info
} from 'lucide-react';
import { TopologyChangeRequest } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useRealtimeSync } from '../lib/realtime';
import { formatDateTime, formatRelativeTime } from '../utils/dateTime';

export const ApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'DEVICE' | 'TOPOLOGY'>('DEVICE');

  // Topology State
  const [topoRequests, setTopoRequests] = useState<TopologyChangeRequest[]>([]);
  const [topoLoading, setTopoLoading] = useState(false);
  const [topoStatusFilter, setTopoStatusFilter] = useState('PENDING');
  const [selectedTopo, setSelectedTopo] = useState<TopologyChangeRequest | null>(null);

  // Device Proposals State
  const [deviceProposals, setDeviceProposals] = useState<any[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceStatusFilter, setDeviceStatusFilter] = useState('PENDING_APPROVAL');
  const [selectedProposal, setSelectedProposal] = useState<any | null>(null);

  // Global Pending Counts for Tab Badges
  const [pendingDeviceCount, setPendingDeviceCount] = useState<number>(0);
  const [pendingTopoCount, setPendingTopoCount] = useState<number>(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTabCounts = useCallback(async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        api.getProposals({ status: 'PENDING_APPROVAL' }),
        api.getApprovals({ status: 'PENDING' })
      ]);
      if (pRes && pRes.success) {
        setPendingDeviceCount(pRes.data?.length || 0);
      }
      if (tRes && tRes.success) {
        setPendingTopoCount(tRes.data?.length || 0);
      }
    } catch (e) {
      console.warn('Failed to fetch approval counts:', e);
    }
  }, []);

  const fetchTopoApprovals = useCallback(async () => {
    setTopoLoading(true);
    try {
      const res = await api.getApprovals({
        status: topoStatusFilter || undefined,
        search: searchTerm || undefined
      });
      if (res.success) {
        setTopoRequests(res.data || []);
        setSelectedTopo(prev => {
          if (prev && res.data?.some((r: any) => r.id === prev.id)) {
            return res.data.find((r: any) => r.id === prev.id);
          }
          return res.data && res.data.length > 0 ? res.data[0] : null;
        });
      }
    } catch (err) {
      console.error('Error fetching topology approvals:', err);
    } finally {
      setTopoLoading(false);
    }
  }, [topoStatusFilter, searchTerm]);

  const fetchDeviceProposals = useCallback(async () => {
    setDeviceLoading(true);
    try {
      const queryParams = {
        status: deviceStatusFilter === 'ALL' ? undefined : deviceStatusFilter,
        search: searchTerm || undefined
      };
      
      console.log('[DEBUG] Fetching device proposals:', queryParams);
      const res: any = await api.getProposals(queryParams);
      console.log('[DEBUG] Device proposals response:', res);

      if (res && res.success) {
        const list = res.data || [];
        console.log('[DEBUG] Device proposals count:', list.length);
        setDeviceProposals(list);
        setSelectedProposal((prev: any) => {
          if (prev && list.some((p: any) => p.id === prev.id)) {
            return list.find((p: any) => p.id === prev.id);
          }
          return list.length > 0 ? list[0] : null;
        });
      } else {
        setDeviceProposals([]);
        setSelectedProposal(null);
      }
    } catch (err) {
      console.error('Error fetching device proposals:', err);
      setDeviceProposals([]);
      setSelectedProposal(null);
    } finally {
      setDeviceLoading(false);
    }
  }, [deviceStatusFilter, searchTerm]);

  useEffect(() => {
    fetchTabCounts();
  }, [fetchTabCounts]);

  useEffect(() => {
    if (activeTab === 'TOPOLOGY') {
      fetchTopoApprovals();
    } else {
      fetchDeviceProposals();
    }
  }, [activeTab, fetchTopoApprovals, fetchDeviceProposals]);

  useRealtimeSync(() => {
    fetchTabCounts();
    if (activeTab === 'TOPOLOGY') {
      fetchTopoApprovals();
    } else {
      fetchDeviceProposals();
    }
  });

  const handleManualRefresh = () => {
    fetchTabCounts();
    if (activeTab === 'TOPOLOGY') {
      fetchTopoApprovals();
    } else {
      fetchDeviceProposals();
    }
  };

  const handleTopoReview = async (action: 'APPROVED' | 'REJECTED' | 'REQUEST_INFO') => {
    if (!selectedTopo) return;
    if (action === 'REJECTED' && !reviewNotes.trim()) {
      alert('Vui lòng nhập lý do từ chối vào ô Ghi chú');
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.reviewApproval(selectedTopo.id, action, reviewNotes);
      if (res.success) {
        alert(res.message || 'Xử lý sơ đồ thành công');
        setSelectedTopo(null);
        setReviewNotes('');
        fetchTopoApprovals();
        fetchTabCounts();
      }
    } catch (err: any) {
      alert(err.message || 'Xử lý thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeviceProposalReview = async (action: 'APPROVED' | 'REJECTED') => {
    if (!selectedProposal) return;
    if (action === 'REJECTED' && !reviewNotes.trim()) {
      alert('Vui lòng nhập lý do từ chối vào ô Ghi chú xử lý');
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.reviewProposal(selectedProposal.id, {
        action,
        review_notes: reviewNotes
      });
      if (res.success) {
        alert(res.message || 'Xử lý đề xuất thành công');
        setSelectedProposal(null);
        setReviewNotes('');
        fetchDeviceProposals();
        fetchTabCounts();
      }
    } catch (err: any) {
      alert(err.message || 'Xử lý phê duyệt thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'CREATE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800"><PlusCircle className="w-3 h-3 mr-1" /> Thêm mới</span>;
      case 'UPDATE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800"><RefreshCw className="w-3 h-3 mr-1" /> Cập nhật</span>;
      case 'LOCATION':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800"><MapPin className="w-3 h-3 mr-1" /> Vị trí GPS</span>;
      case 'STATUS':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800"><Activity className="w-3 h-3 mr-1" /> Trạng thái</span>;
      case 'DELETE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800"><Trash2 className="w-3 h-3 mr-1" /> Đề xuất xóa</span>;
      case 'IMAGE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-100 text-cyan-800"><ImageIcon className="w-3 h-3 mr-1" /> Hình ảnh</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800">{type}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_APPROVAL':
      case 'PENDING':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 border border-amber-300"><Clock className="w-3.5 h-3.5 mr-1 animate-pulse" /> Chờ duyệt</span>;
      case 'APPROVED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-300"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Đã duyệt</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-700 border border-red-300"><XCircle className="w-3.5 h-3.5 mr-1" /> Đã từ chối</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const parseSnapshot = (snapshotStr?: string) => {
    if (!snapshotStr) return { nodes: [], edges: [] };
    try {
      return JSON.parse(snapshotStr);
    } catch (e) {
      return { nodes: [], edges: [] };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" /> Trung tâm Phê duyệt & Kiểm soát Thay đổi
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">Phê Duyệt Đề Xuất Vận Hành & Topology</h1>
          <p className="text-xs text-slate-400 mt-1">
            Xem xét và phê duyệt các đề xuất thay đổi thiết bị hiện trường từ Nhân viên vận hành & sơ đồ topology.
          </p>
        </div>

        {/* Tab Switcher and Refresh */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={handleManualRefresh}
            title="Làm mới danh sách"
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${(deviceLoading || topoLoading) ? 'animate-spin text-blue-400' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => { setActiveTab('DEVICE'); setSelectedTopo(null); }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'DEVICE' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Đề xuất Thiết bị</span>
              {pendingDeviceCount > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full leading-none">
                  {pendingDeviceCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('TOPOLOGY'); setSelectedProposal(null); }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'TOPOLOGY' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Sơ đồ Topology</span>
              {pendingTopoCount > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full leading-none">
                  {pendingTopoCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto">
          {activeTab === 'DEVICE' ? (
            [
              { key: 'PENDING_APPROVAL', label: 'Chờ Duyệt', color: 'text-amber-500' },
              { key: 'APPROVED', label: 'Đã Duyệt', color: 'text-emerald-500' },
              { key: 'REJECTED', label: 'Đã Từ Chối', color: 'text-red-500' },
              { key: 'ALL', label: 'Tất Cả Trạng Thái', color: 'text-slate-500' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setDeviceStatusFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all ${
                  deviceStatusFilter === tab.key
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className={tab.color}>●</span> {tab.label}
              </button>
            ))
          ) : (
            [
              { key: 'PENDING', label: 'Chờ Duyệt', color: 'text-amber-500' },
              { key: 'APPROVED', label: 'Đã Duyệt', color: 'text-emerald-500' },
              { key: 'REJECTED', label: 'Đã Từ Chối', color: 'text-red-500' },
              { key: '', label: 'Tất Cả Trạng Thái', color: 'text-slate-500' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setTopoStatusFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all ${
                  topoStatusFilter === tab.key
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className={tab.color}>●</span> {tab.label}
              </button>
            ))
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm kiếm mã đề xuất, tên thiết bị, người gửi..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Content Layout */}
      {activeTab === 'DEVICE' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List of Device Proposals */}
          <div className="lg:col-span-2 space-y-3">
            {deviceLoading ? (
              <div className="text-center py-16 text-slate-500 text-xs bg-white rounded-xl border border-slate-200">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                Đang tải danh sách đề xuất thiết bị...
              </div>
            ) : (
              <div className="text-[10px] text-slate-400 mb-2">
                Debug: filter={deviceStatusFilter}, count={deviceProposals.length}
              </div>
            )}
            {deviceLoading ? null : deviceProposals.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs bg-white rounded-xl border border-slate-200 space-y-3">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-800 text-sm">Không tìm thấy đề xuất thiết bị nào</p>
                <p className="text-slate-500 text-xs max-w-sm mx-auto">
                  {deviceStatusFilter !== 'ALL' 
                    ? `Hiện không có đề xuất nào ở trạng thái lọc đã chọn. Hãy thử chuyển sang "Tất Cả Trạng Thái" hoặc làm mới.` 
                    : `Chưa có đề xuất thay đổi thiết bị nào được gửi từ hiện trường.`}
                </p>
                <button
                  onClick={() => { setDeviceStatusFilter('ALL'); setSearchTerm(''); }}
                  className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 transition text-xs inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Xem tất cả trạng thái
                </button>
              </div>
            ) : (
              deviceProposals.map(p => {
                const isSelected = selectedProposal?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => { setSelectedProposal(p); setReviewNotes(''); }}
                    className={`bg-white rounded-xl border p-4 shadow-sm transition-all cursor-pointer hover:shadow-md ${
                      isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{p.request_code}</span>
                        {getTypeBadge(p.type)}
                      </div>
                      {getStatusBadge(p.status)}
                    </div>

                    <div className="my-1.5">
                      <h4 className="text-sm font-bold text-slate-900">{p.device_name}</h4>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">Mã TB: <strong className="text-slate-700">{p.target_device_id_str}</strong></p>
                    </div>

                    <div className="text-xs text-slate-600 line-clamp-2 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="font-semibold text-slate-700">Lý do đề xuất:</span> {p.reason || 'Không có ghi chú'}
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-2.5 mt-2.5 border-t border-slate-100 gap-2">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        Người gửi: <strong className="text-slate-800">{p.requester_fullname}</strong> ({p.requester_team || p.requester_unit || 'Hiện trường'})
                      </span>
                      <span className="flex items-center gap-1 text-slate-400 font-mono" title={formatDateTime(p.created_at)}>
                        <Clock className="w-3 h-3 text-blue-500" />
                        {formatRelativeTime(p.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Device Proposal Review Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit sticky top-6 shadow-sm">
            {selectedProposal ? (
              <div className="space-y-4 text-xs">
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-blue-600">{selectedProposal.request_code}</span>
                    <h3 className="font-bold text-slate-900 text-sm mt-0.5">{selectedProposal.device_name}</h3>
                  </div>
                  <div>{getTypeBadge(selectedProposal.type)}</div>
                </div>

                {/* Requester Details */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Người gửi:</span>
                    <strong className="text-slate-900">{selectedProposal.requester_fullname} ({selectedProposal.requester_username})</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Đơn vị / Đội:</span>
                    <span className="text-slate-800 font-medium">{selectedProposal.requester_unit || 'EVN HANOI'} {selectedProposal.requester_team ? `• ${selectedProposal.requester_team}` : ''}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Thời gian gửi:</span>
                    <span className="text-slate-700 font-mono font-semibold">{formatDateTime(selectedProposal.created_at)} ({formatRelativeTime(selectedProposal.created_at)})</span>
                  </div>
                </div>

                {/* Side-by-Side Data Comparison */}
                <div className="space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Thông số Đề xuất Thay đổi:</span>
                  <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-200 space-y-1.5 text-slate-800 font-medium">
                    {Object.entries(selectedProposal.proposed_data || {}).map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between border-b border-blue-100 last:border-0 pb-1">
                        <span className="font-mono text-blue-800 text-[11px]">{k}:</span>
                        <span className="font-bold text-slate-900 text-right">{String(v || 'N/A')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-700">Lý do từ hiện trường:</span>
                  <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-800 mt-1 leading-relaxed">
                    {selectedProposal.reason || 'Không có ghi chú bổ sung.'}
                  </p>
                </div>

                {/* Approval Review Box */}
                {selectedProposal.status === 'PENDING_APPROVAL' ? (
                  <div className="space-y-3 pt-3 border-t border-slate-200">
                    <label className="block font-bold text-slate-800">Ý kiến Phê duyệt / Ghi chú xử lý:</label>
                    <textarea
                      rows={3}
                      value={reviewNotes}
                      onChange={e => setReviewNotes(e.target.value)}
                      placeholder="Nhập ghi chú chỉ đạo hoặc lý do từ chối..."
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleDeviceProposalReview('APPROVED')}
                        disabled={actionLoading}
                        className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Duyệt & Cập nhật
                      </button>
                      <button
                        onClick={() => handleDeviceProposalReview('REJECTED')}
                        disabled={actionLoading}
                        className="py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" /> Từ chối đề xuất
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-slate-200 space-y-2 bg-slate-50 p-3 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Trạng thái:</span>
                      {getStatusBadge(selectedProposal.status)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Người xử lý:</span>
                      <strong className="text-slate-800">{selectedProposal.reviewer_fullname || 'Hệ thống'}</strong>
                    </div>
                    {selectedProposal.review_notes && (
                      <div className="pt-1">
                        <span className="text-slate-500 block text-[11px]">Ý kiến phê duyệt:</span>
                        <p className="bg-white p-2 rounded border border-slate-200 text-slate-700 italic mt-0.5">
                          "{selectedProposal.review_notes}"
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                <FileText className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">Chưa chọn đề xuất nào</p>
                <p className="text-slate-400">Chọn một đề xuất từ danh sách bên trái để xem chi tiết và thực hiện phê duyệt.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* TOPOLOGY APPROVALS TAB */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {topoLoading ? (
              <div className="text-center py-16 text-slate-500 text-xs bg-white rounded-xl border border-slate-200">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-500" />
                Đang tải danh sách sơ đồ topology...
              </div>
            ) : topoRequests.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center border border-slate-200 text-slate-500 text-xs space-y-3">
                <ShieldCheck className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-bold text-slate-800 text-sm">Không có yêu cầu phê duyệt sơ đồ topology nào</p>
                <p className="text-slate-400 text-xs max-w-sm mx-auto">
                  Hiện không có yêu cầu thay đổi cấu trúc sơ đồ khép vòng nào đang chờ duyệt.
                </p>
              </div>
            ) : (
              topoRequests.map(req => {
                const isSelected = selectedTopo?.id === req.id;
                return (
                  <div
                    key={req.id}
                    onClick={() => setSelectedTopo(req)}
                    className={`bg-white border rounded-xl p-4 shadow-sm transition-all cursor-pointer hover:shadow-md ${
                      isSelected ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/10' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 font-mono font-bold text-xs rounded border border-purple-200">
                          v{req.version_str}
                        </span>
                        <span className="font-bold text-slate-900 text-xs">{req.loop_name}</span>
                        <span className="font-mono text-xs text-slate-500">({req.loop_id})</span>
                      </div>
                      {getStatusBadge(req.status)}
                    </div>
                    <p className="text-xs text-slate-700 font-medium mb-3 bg-slate-50 p-2 rounded border border-slate-100">{req.change_summary}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                      <span>Trình bởi: <strong className="text-slate-800">{req.requester_fullname}</strong></span>
                      <span className="font-mono text-slate-600 font-semibold" title={formatDateTime(req.created_at)}>
                        {formatDateTime(req.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Topology Detail */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit sticky top-6 shadow-sm">
            {selectedTopo ? (
              <div className="space-y-4 text-xs">
                <div className="border-b border-slate-200 pb-3">
                  <span className="text-[10px] font-mono font-bold text-purple-600 uppercase">Phê duyệt Sơ đồ Topology</span>
                  <h3 className="font-bold text-slate-900 text-sm mt-0.5">{selectedTopo.loop_name}</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Phiên bản: <strong className="text-slate-800 font-mono">v{selectedTopo.version_str}</strong></p>
                </div>

                <div>
                  <span className="font-bold text-slate-700 block mb-1">Lý do trình duyệt:</span>
                  <p className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 leading-relaxed">
                    {selectedTopo.reason || 'Không có ghi chú lý do'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 block">Cấu trúc Topology:</span>
                  {(() => {
                    const before = parseSnapshot(selectedTopo.before_snapshot);
                    const after = parseSnapshot(selectedTopo.after_snapshot);
                    return (
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">TRƯỚC SỬA</div>
                          <div className="font-bold text-slate-800 mt-1 text-sm">{before.nodes?.length || 0} Thiết bị</div>
                          <div className="text-[11px] text-slate-500">{before.edges?.length || 0} Đoạn liên kết</div>
                        </div>
                        <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
                          <div className="text-[10px] text-purple-700 font-bold uppercase">SAU SỬA</div>
                          <div className="font-bold text-purple-900 mt-1 text-sm">{after.nodes?.length || 0} Thiết bị</div>
                          <div className="text-[11px] text-purple-700">{after.edges?.length || 0} Đoạn liên kết</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {selectedTopo.status === 'PENDING' && (
                  <div className="space-y-3 pt-3 border-t border-slate-200">
                    <label className="block font-bold text-slate-800">Ý kiến chỉ đạo:</label>
                    <textarea
                      rows={3}
                      value={reviewNotes}
                      onChange={e => setReviewNotes(e.target.value)}
                      placeholder="Ghi chú ý kiến phê duyệt hoặc lý do từ chối..."
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleTopoReview('APPROVED')}
                        disabled={actionLoading}
                        className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Duyệt Sơ đồ
                      </button>
                      <button
                        onClick={() => handleTopoReview('REJECTED')}
                        disabled={actionLoading}
                        className="py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-1"
                      >
                        <XCircle className="w-4 h-4" /> Từ chối
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                <ShieldCheck className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">Chưa chọn sơ đồ nào</p>
                <p>Chọn một yêu cầu sơ đồ bên trái để xem và xử lý.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

