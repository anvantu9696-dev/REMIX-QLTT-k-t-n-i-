import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  AlertCircle,
  PlusCircle,
  RefreshCw,
  MapPin,
  Activity,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDateTime, formatRelativeTime } from '../utils/dateTime';

export const MyProposalsPage: React.FC = () => {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProposal, setSelectedProposal] = useState<any | null>(null);

  useEffect(() => {
    fetchMyProposals();
  }, [filterStatus, filterType]);

  const fetchMyProposals = async () => {
    setLoading(true);
    try {
      const res = await api.getMyProposals({
        status: filterStatus === 'ALL' ? undefined : filterStatus,
        type: filterType === 'ALL' ? undefined : filterType,
        search: searchTerm || undefined
      });
      if (res.success) {
        setProposals(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMyProposals();
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
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 border border-amber-300"><Clock className="w-3.5 h-3.5 mr-1 animate-pulse" /> Đang chờ duyệt</span>;
      case 'APPROVED':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-300"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Đã phê duyệt</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-700 border border-red-300"><XCircle className="w-3.5 h-3.5 mr-1" /> Đã từ chối</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Danh sách Đề xuất của tôi
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi tiến độ xử lý và kết quả phê duyệt các đề xuất thay đổi dữ liệu hiện trường.
          </p>
        </div>
        <button
          onClick={fetchMyProposals}
          className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition"
        >
          <RefreshCw className="w-4 h-4 mr-1.5" /> Làm mới
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo Mã đề xuất, Mã thiết bị, Tên thiết bị, Lý do..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING_APPROVAL">Đang chờ duyệt</option>
              <option value="APPROVED">Đã phê duyệt</option>
              <option value="REJECTED">Đã từ chối</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">Tất cả loại đề xuất</option>
              <option value="CREATE">Thêm mới thiết bị</option>
              <option value="UPDATE">Cập nhật thông tin</option>
              <option value="LOCATION">Vị trí GPS</option>
              <option value="STATUS">Trạng thái làm việc</option>
              <option value="DELETE">Đề xuất xóa</option>
              <option value="IMAGE">Hình ảnh hiện trường</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition shrink-0"
            >
              Tìm kiếm
            </button>
          </div>
        </form>
      </div>

      {/* Proposals List */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs bg-white rounded-xl border border-slate-200">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Đang tải danh sách đề xuất...
        </div>
      ) : proposals.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-xs bg-white rounded-xl border border-slate-200 space-y-2">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-semibold text-slate-700">Chưa có đề xuất nào</p>
          <p className="text-slate-400">Bạn chưa gửi đề xuất nào hoặc không tìm thấy kết quả phù hợp với bộ lọc.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proposals.map((p) => (
            <div
              key={p.id}
              className={`bg-white rounded-xl border transition-all duration-200 p-4 shadow-sm hover:shadow-md flex flex-col justify-between ${
                p.status === 'REJECTED' ? 'border-red-200 bg-red-50/20' : 'border-slate-200'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <span className="font-mono text-xs font-bold text-slate-800">{p.request_code}</span>
                  {getTypeBadge(p.type)}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900 truncate">{p.device_name}</h4>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">Mã TB: {p.target_device_id_str}</p>
                </div>

                <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <p className="line-clamp-2">
                    <span className="font-semibold text-slate-700">Lý do gửi:</span> {p.reason || 'Không có ghi chú'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Gửi: {formatDateTime(p.created_at)} ({formatRelativeTime(p.created_at)})</span>
                  </p>
                </div>

                {/* Rejection Notice Banner */}
                {p.status === 'REJECTED' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-800 space-y-1">
                    <div className="font-bold flex items-center text-red-700">
                      <XCircle className="w-3.5 h-3.5 mr-1 text-red-600 shrink-0" />
                      Lý do từ chối:
                    </div>
                    <p className="text-red-900 italic font-medium">{p.review_notes || 'Cấp quản lý không phê duyệt đề xuất này.'}</p>
                    <p className="text-[10px] text-red-600 font-normal font-mono">
                      Duyệt bởi: {p.reviewer_fullname || 'Cấp quản lý'} ({p.reviewed_at ? formatDateTime(p.reviewed_at) : ''})
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                <div>{getStatusBadge(p.status)}</div>
                <button
                  onClick={() => setSelectedProposal(p)}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded transition"
                >
                  <Eye className="w-3.5 h-3.5 mr-1" /> Xem So sánh
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comparison Detail Modal */}
      {selectedProposal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
              <div>
                <span className="text-xs font-mono font-bold text-blue-600">{selectedProposal.request_code}</span>
                <h3 className="text-base font-bold text-slate-900">Chi tiết So sánh Đề xuất</h3>
              </div>
              <button
                onClick={() => setSelectedProposal(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Proposal Header Info */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Loại đề xuất</span>
                  <div className="mt-1">{getTypeBadge(selectedProposal.type)}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Trạng thái</span>
                  <div className="mt-1">{getStatusBadge(selectedProposal.status)}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Tên thiết bị</span>
                  <span className="font-semibold text-slate-800">{selectedProposal.device_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Mã thiết bị</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedProposal.target_device_id_str}</span>
                </div>
              </div>

              {/* Side-by-Side Data Comparison */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  So sánh Dữ liệu Chính thức & Dữ liệu Đề xuất
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Official Data */}
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-2">
                    <div className="font-bold text-slate-600 border-b border-slate-200 pb-1.5 flex items-center justify-between">
                      <span>DỮ LIỆU CHÍNH THỨC</span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">Hiện tại</span>
                    </div>
                    {selectedProposal.current_data ? (
                      <div className="space-y-1.5 text-slate-700">
                        <p><span className="text-slate-400">Tên TB:</span> {selectedProposal.current_data.name}</p>
                        <p><span className="text-slate-400">Loại:</span> {selectedProposal.current_data.device_type}</p>
                        <p><span className="text-slate-400">Vị trí trụ:</span> {selectedProposal.current_data.pole_number || 'N/A'}</p>
                        <p><span className="text-slate-400">Trạng thái dao:</span> {selectedProposal.current_data.switch_status || 'UNKNOWN'}</p>
                        <p><span className="text-slate-400">Tọa độ Lat:</span> {selectedProposal.current_data.latitude || 'Chưa có'}</p>
                        <p><span className="text-slate-400">Tọa độ Lng:</span> {selectedProposal.current_data.longitude || 'Chưa có'}</p>
                      </div>
                    ) : (
                      <p className="text-slate-400 italic">Chưa có (Thiết bị mới tạo đề xuất)</p>
                    )}
                  </div>

                  {/* Proposed Data */}
                  <div className="bg-blue-50/50 rounded-xl p-3.5 border border-blue-200 text-xs space-y-2">
                    <div className="font-bold text-blue-800 border-b border-blue-200 pb-1.5 flex items-center justify-between">
                      <span>DỮ LIỆU ĐỀ XUẤT</span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono">Mới</span>
                    </div>
                    <div className="space-y-1.5 text-slate-800 font-medium">
                      {Object.entries(selectedProposal.proposed_data || {}).map(([key, val]) => (
                        <p key={key}>
                          <span className="text-blue-600/80 font-mono">{key}:</span> {String(val || 'N/A')}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Reason & Notes */}
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-bold text-slate-700">Lý do & Ghi chú từ Người đề xuất:</span>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-800 mt-1">
                    {selectedProposal.reason || 'Không có ghi chú.'}
                  </div>
                </div>

                {selectedProposal.review_notes && (
                  <div>
                    <span className="font-bold text-red-700">Ghi chú Phê duyệt / Lý do Từ chối:</span>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-200 text-red-900 mt-1 font-medium">
                      {selectedProposal.review_notes}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedProposal(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold"
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
