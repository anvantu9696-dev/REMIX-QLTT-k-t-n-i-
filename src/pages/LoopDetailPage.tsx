import React, { useState, useEffect } from 'react';
import {
  GitFork,
  ArrowLeft,
  Save,
  Send,
  History,
  RotateCcw,
  GitCompare,
  Building2,
  Zap,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Layers,
  Info,
  ShieldCheck,
  Check,
  X,
  MapPin,
  Compass,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { TopologyCanvas } from '../components/topology/TopologyCanvas';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { Loop, TopologyNode, TopologyEdge, TopologyVersion } from '../types';
import { api } from '../lib/api';
import { normalizeLoop } from '../lib/loopUtils';
import { useAuth } from '../context/AuthContext';
import { formatDateTime, formatDate } from '../utils/dateTime';

export const LoopDetailPage: React.FC = () => {
  // Robustly extract ID
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const id = pathParts[pathParts.length - 1] === 'loops' ? null : pathParts[pathParts.length - 1];
  
  console.log('[LoopDetailPage] Parsed ID from URL:', { pathname: window.location.pathname, id });

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('popstate'));
  };
  const { user, hasRole } = useAuth();

  const [loop, setLoop] = useState<Loop | null>(null);
  const [activeVersion, setActiveVersion] = useState<TopologyVersion | null>(null);
  const [versions, setVersions] = useState<TopologyVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | string>('');

  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [edges, setEdges] = useState<TopologyEdge[]>([]);

  const [pendingRequest, setPendingRequest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  // Submit modal / Save modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');
  const [reason, setReason] = useState('');

  // Version Comparison Modal
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareVersionAId, setCompareVersionAId] = useState<number | string>('');
  const [compareVersionBId, setCompareVersionBId] = useState<number | string>('');
  const [compareDiff, setCompareDiff] = useState<{
    addedNodes: string[];
    removedNodes: string[];
    addedEdges: string[];
    removedEdges: string[];
  } | null>(null);

  const fetchLoopDetail = async (versionId?: number | string) => {
    if (!id) return;
    
    setLoading(true);

    // Auto redirect if id is '0'
    if (id === '0') {
      try {
        const listRes = await api.getLoops({});
        if (listRes.success && listRes.data && listRes.data.length > 0) {
           navigate(`/loops/${listRes.data[0].id}`);
           return; // Do not setLoading(false) here to avoid flashing error before unmount
        }
      } catch (e) {
        console.error('Failed to fetch loops for redirect', e);
      }
      setLoading(false);
      return;
    }
    
    try {
      const res = await api.getLoop(id, versionId);
      if (res.success) {
        setLoop(normalizeLoop(res.data.loop));
        setActiveVersion(res.data.active_version);
        setVersions(res.data.versions);
        setNodes(res.data.nodes || []);
        setEdges(res.data.edges || []);
        setPendingRequest(res.data.pending_request || null);
        if (res.data.active_version) {
          setSelectedVersionId(res.data.active_version.id);
        }
        setIsDirty(false);
        setLoading(false);
      } else {
        // Fallback fetch list if not found
        try {
          const listRes = await api.getLoops({});
          if (listRes.success && listRes.data && listRes.data.length > 0) {
             navigate(`/loops/${listRes.data[0].id}`);
             return;
          }
        } catch (e) {}
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error loading loop detail:', err);
      // Fallback fetch list if not found
      try {
        const listRes = await api.getLoops({});
        if (listRes.success && listRes.data && listRes.data.length > 0) {
           navigate(`/loops/${listRes.data[0].id}`);
           return;
        }
      } catch (e) {}
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoopDetail();
  }, [id]);

  const handleVersionChange = (versionId: string) => {
    setSelectedVersionId(versionId);
    fetchLoopDetail(versionId);
  };

  const handleTopologyChange = (newNodes: TopologyNode[], newEdges: TopologyEdge[]) => {
    setNodes(newNodes);
    setEdges(newEdges);
    setIsDirty(true);
  };

  // Save Draft or Submit for Approval
  const handleSaveTopology = async (submitForApproval: boolean) => {
    if (!id) return;
    try {
      const res = await api.saveTopologyVersion(id, {
        nodes,
        edges,
        change_summary: changeSummary || `Thay đổi sơ đồ v${activeVersion?.version || '1.0'}`,
        reason: reason || 'Cập nhật sơ đồ',
        submit_for_approval: submitForApproval,
        schemaVersion: loop.schemaVersion || 1
      });

      if (res.success) {
        setIsSubmitModalOpen(false);
        setChangeSummary('');
        setReason('');
        alert(res.message);
        fetchLoopDetail();
      }
    } catch (err: any) {
      alert(err.message || 'Lưu thất bại');
    }
  };

  // Restore Version
  const handleRestoreVersion = async (v: TopologyVersion) => {
    if (
      confirm(
        `XÁC NHẬN KHÔI PHỤC:\n\nBạn có muốn khôi phục sơ đồ về Phiên bản v${v.version} không?\nHệ thống sẽ tự động khởi tạo một PHIÊN BẢN MỚI cao hơn kế thừa từ v${v.version}.`
      )
    ) {
      try {
        const res = await api.restoreTopologyVersion(id!, v.id, `Khôi phục sơ đồ từ phiên bản v${v.version}`);
        if (res.success) {
          alert(res.message);
          fetchLoopDetail();
        }
      } catch (err: any) {
        alert(err.message || 'Khôi phục thất bại');
      }
    }
  };

  // Run Compare Version Diff
  const handleCompareVersions = () => {
    if (!compareVersionAId || !compareVersionBId) return;

    const vA = versions.find(v => String(v.id) === String(compareVersionAId));
    const vB = versions.find(v => String(v.id) === String(compareVersionBId));

    if (!vA || !vB) return;

    let nodesA: any[] = [];
    let nodesB: any[] = [];
    let edgesA: any[] = [];
    let edgesB: any[] = [];

    try {
      nodesA = JSON.parse(vA.nodes_json || '[]');
      nodesB = JSON.parse(vB.nodes_json || '[]');
      edgesA = JSON.parse(vA.edges_json || '[]');
      edgesB = JSON.parse(vB.edges_json || '[]');
    } catch (e) {
      console.error(e);
    }

    const setDevA = new Set(nodesA.map((n: any) => n.device_id));
    const setDevB = new Set(nodesB.map((n: any) => n.device_id));

    const addedNodes = nodesB.filter((n: any) => !setDevA.has(n.device_id)).map((n: any) => n.device_id);
    const removedNodes = nodesA.filter((n: any) => !setDevB.has(n.device_id)).map((n: any) => n.device_id);

    const keyEdge = (e: any) => `${e.source_device_id}->${e.target_device_id}`;
    const setEdgeA = new Set(edgesA.map(keyEdge));
    const setEdgeB = new Set(edgesB.map(keyEdge));

    const addedEdges = edgesB.filter((e: any) => !setEdgeA.has(keyEdge(e))).map((e: any) => `${e.source_device_id} → ${e.target_device_id}`);
    const removedEdges = edgesA.filter((e: any) => !setEdgeB.has(keyEdge(e))).map((e: any) => `${e.source_device_id} → ${e.target_device_id}`);

    setCompareDiff({
      addedNodes,
      removedNodes,
      addedEdges,
      removedEdges
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!loop) {
    return (
      <div className="text-center py-20 text-slate-500 text-xs space-y-4">
        <div>Không tìm thấy mạch Khép vòng</div>
        <button onClick={() => fetchLoopDetail()} className="px-4 py-2 bg-slate-800 text-white rounded-lg">Thử lại</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div>
          <button
            onClick={() => navigate('/loops')}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Trở về Danh sách Khép vòng</span>
          </button>

          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 font-mono font-black text-xs rounded-lg border border-blue-500/30">
              {loop.loop_id}
            </span>
            <h1 className="text-lg font-black text-white tracking-tight">{loop.name}</h1>
          </div>
        </div>

        {/* Version & Actions Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Version Selector */}
          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <History className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-400 font-bold">Phiên bản:</span>
            <select
              value={selectedVersionId}
              onChange={e => handleVersionChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              {versions.map(v => (
                <option key={v.id} value={v.id} className="bg-slate-900 text-white">
                  v{v.version} ({v.status})
                </option>
              ))}
            </select>
          </div>

          {/* Compare Button */}
          <button
            onClick={() => {
              if (versions.length >= 2) {
                setCompareVersionAId(versions[1].id);
                setCompareVersionBId(versions[0].id);
              }
              setIsCompareModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all"
          >
            <GitCompare className="w-4 h-4 text-purple-400" />
            <span>So Sánh Phiên Bản</span>
          </button>

          {/* Save & Submit Actions */}
          {(hasRole('ADMIN') || (hasRole('MANAGER') || hasRole('SHIFT_LEADER'))) && (
            <>
              <button
                onClick={() => handleSaveTopology(false)}
                className={`flex items-center space-x-1.5 px-4 py-2 font-bold rounded-xl text-xs shadow-lg transition-all ${
                  isDirty
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>Lưu Bản Nháp</span>
              </button>

              <button
                onClick={() => setIsSubmitModalOpen(true)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/20 transition-all"
              >
                <Send className="w-4 h-4" />
                <span>Trình Phê Duyệt</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Pending Approval Notice if exists */}
      {pendingRequest && (
        <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3 text-amber-300">
            <Clock className="w-5 h-5 animate-spin" />
            <div>
              <strong className="font-bold">Đang có yêu cầu trình phê duyệt chờ xử lý:</strong> Sơ đồ v{pendingRequest.version_str} do{' '}
              <strong className="text-white">{pendingRequest.requester_fullname}</strong> gửi ngày{' '}
              {formatDate(pendingRequest.created_at)}.
            </div>
          </div>

          <button
            onClick={() => navigate('/approvals')}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition-colors"
          >
            Chuyển tới Trang Phê Duyệt →
          </button>
        </div>
      )}

      {/* MAIN TOPOLOGY DYNAMIC GRAPH CANVAS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <span className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>SƠ ĐỒ GRAPH ĐỘNG THỜI GIAN THỰC (TOPOLOGY CANVAS)</span>
          </span>
          <span className="text-slate-500">Kéo thả để chỉnh sửa vị trí • Thêm/thay thế/tách thiết bị</span>
        </div>

        <ErrorBoundary fallbackTitle="Không thể tải Sơ đồ Topology Canvas">
          <TopologyCanvas
            nodes={nodes}
            edges={edges}
            onChange={handleTopologyChange}
            readOnly={!(hasRole('ADMIN') || (hasRole('MANAGER') || hasRole('SHIFT_LEADER')))}
            loop={loop}
            onEditLoop={() => navigate('/loops')}
          />
        </ErrorBoundary>
      </div>

      {/* BOTTOM DETAIL PANELS (Giao diện 2 cột) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel 1: Loop Metadata & Endpoints */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-2">
            <Info className="w-4 h-4 text-blue-400" />
            <span>Thông Tin Chi Tiết Khép Vòng</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Trạng thái vận hành:</span>
              <span
                className={`font-bold ${
                  (loop.operation_status || loop.status) === 'CLOSED' ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {(loop.operation_status || loop.status) === 'CLOSED' ? '🟢 Đang Khép Vòng' : '🟡 Đang Mở Vòng'}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Trạng thái cấu hình:</span>
              <span className="font-bold text-blue-400">
                {loop.configuration_status || loop.config_status || 'ACTIVE'}
              </span>
            </div>

            {(loop.loop_device_id || loop.loop_device_code) && (
              <div className="p-3.5 bg-gradient-to-r from-amber-950/40 via-purple-950/40 to-slate-900 border-2 border-amber-400/60 rounded-xl space-y-2 shadow-[0_0_15px_rgba(245,158,11,0.2)] ring-1 ring-amber-400/30">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase font-black tracking-wider text-amber-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    ⭐ ĐIỂM DỪNG PHÁP LÝ ⭐
                  </div>
                  {loop.loop_device_type && (
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-200 text-[10px] font-black rounded border border-purple-400/40">
                      {loop.loop_device_type}
                    </span>
                  )}
                </div>
                <div className="font-mono font-black text-white text-sm bg-slate-950/80 px-2.5 py-1 rounded-lg border border-amber-400/30 inline-block">
                  {loop.loop_device_code || loop.loop_device_name || loop.loop_device_id}
                </div>
                
                {/* Trạng thái đóng cắt */}
                <div className="flex items-center justify-between pt-1.5 border-t border-amber-900/50 text-[11px]">
                  <span className="text-slate-300 font-medium">Trạng thái đóng cắt:</span>
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-black ${
                    (loop.loop_device_switch_status === 'CLOSED' || loop.operation_status === 'CLOSED')
                      ? 'bg-emerald-500 text-slate-950 shadow-xs'
                      : 'bg-rose-500 text-white shadow-xs'
                  }`}>
                    {(loop.loop_device_switch_status === 'CLOSED' || loop.operation_status === 'CLOSED') ? 'ĐÓNG (Closed)' : 'MỞ (Open)'}
                  </span>
                </div>
                
                {/* Location Info */}
                <div className="pt-1.5 border-t border-blue-900/40 space-y-1 text-[11px]">
                  <div className="flex items-center space-x-1.5 text-slate-300">
                    <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                    <span>
                      Vị trí trụ: <strong className="text-white font-mono">{loop.loop_device_pole || 'Chưa cập nhật'}</strong>
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-slate-300">
                    <Building2 className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>
                      Đội QLVH: <strong className="text-white">{loop.loop_device_team || loop.loop_device_unit || 'Đội Vận Hành'}</strong>
                    </span>
                  </div>
                  {(loop.latitude || loop.loop_device_latitude) && (loop.longitude || loop.loop_device_longitude) && (
                    <div className="flex items-center space-x-1.5 text-slate-400 font-mono text-[10px]">
                      <Compass className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span>
                        Tọa độ: {Number(loop.latitude || loop.loop_device_latitude).toFixed(5)}, {Number(loop.longitude || loop.loop_device_longitude).toFixed(5)}
                      </span>
                    </div>
                  )}
                  {(loop.google_maps_url || loop.loop_device_maps_url) && (
                    <div className="pt-1">
                      <a
                        href={loop.google_maps_url || loop.loop_device_maps_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-sky-400 hover:text-sky-300 text-[11px] font-semibold"
                      >
                        <span>Mở bản đồ GIS Google Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="text-[10px] uppercase font-bold text-blue-400">Đầu A (Nguồn A)</div>
              <div className="text-slate-200 font-bold">{loop.substation_name_a || 'Trạm A'}</div>
              <div className="text-slate-400 text-[11px]">{loop.feeder_code_a || 'Phát tuyến A'}</div>
              <div className="text-[11px] font-semibold text-slate-200">TB A: {loop.device_name_a || loop.device_code_a || loop.device_id_a}</div>
            </div>

            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="text-[10px] uppercase font-bold text-purple-400">Đầu B (Nguồn B)</div>
              <div className="text-slate-200 font-bold">{loop.substation_name_b || 'Trạm B'}</div>
              <div className="text-slate-400 text-[11px]">{loop.feeder_code_b || 'Phát tuyến B'}</div>
              <div className="text-[11px] font-semibold text-slate-200">TB B: {loop.device_name_b || loop.device_code_b || loop.device_id_b}</div>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Tổng số Thiết bị (Nodes):</span>
              <span className="font-bold text-white">{nodes.length} thiết bị</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Tổng số Kết nối (Edges):</span>
              <span className="font-bold text-white">{edges.length} kết nối</span>
            </div>

            {loop.inspection_cycle && (
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Chu kỳ kiểm tra:</span>
                <span className="font-bold text-slate-200">
                  {loop.inspection_cycle === 'MONTHLY'
                    ? 'Hàng tháng'
                    : loop.inspection_cycle === 'QUARTERLY'
                    ? 'Hàng quý'
                    : 'Hàng năm'}
                </span>
              </div>
            )}

            <div className="pt-2">
              <span className="text-slate-400 block mb-1">Ghi chú phương thức:</span>
              <p className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 text-[11px] leading-relaxed">
                {loop.notes || 'Chưa có ghi chú phương thức'}
              </p>
            </div>
          </div>
        </div>

        {/* Panel 2: Devices Table in Topology */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Danh Sách Thiết Bị Trong Sơ Đồ Topology ({nodes.length})</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Mã Thiết Bị</th>
                  <th className="py-2.5 px-3">Tên Thiết Bị</th>
                  <th className="py-2.5 px-3">Loại</th>
                  <th className="py-2.5 px-3">Trạng Thái Đóng/Mở</th>
                  <th className="py-2.5 px-3">SCADA</th>
                  <th className="py-2.5 px-3">Rơle 79</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {nodes.map((n, index) => {
                  const dev = n.device || ({ name: n.device_id, device_type: 'LBS', switch_status: 'UNKNOWN' } as any);
                  return (
                    <tr key={`loop-node-row-${n.id || n.device_id}-${index}`} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-400">{n.device_id}</td>
                      <td className="py-2.5 px-3 font-bold text-white">{dev.name}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 bg-slate-800 rounded font-bold text-[10px] text-slate-300">
                          {dev.device_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            dev.switch_status === 'CLOSED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : dev.switch_status === 'OPEN'
                              ? 'bg-red-500/20 text-red-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {dev.switch_status === 'CLOSED' ? 'ĐÓNG' : dev.switch_status === 'OPEN' ? 'MỞ' : 'Không rõ'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px]">
                        {dev.scada_status === 'SIGNAL' ? (
                          <span className="text-emerald-400 font-bold">● Có tín hiệu</span>
                        ) : (
                          <span className="text-slate-500">○ Mất tín hiệu</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-400">{dev.relay_79 || 'N_A'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* VERSION HISTORY & RESTORE TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-2">
          <History className="w-4 h-4 text-purple-400" />
          <span>Lịch Sử Các Phiên Bản Topology & Khôi Phục</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Phiên Bản</th>
                <th className="py-2.5 px-3">Trạng Thái Workflow</th>
                <th className="py-2.5 px-3">Tóm Tắt Thay Đổi</th>
                <th className="py-2.5 px-3">Người Tạo</th>
                <th className="py-2.5 px-3">Ngày Tạo</th>
                <th className="py-2.5 px-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {versions.map(v => (
                <tr key={v.id} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-mono font-bold text-white">v{v.version}</td>
                  <td className="py-2.5 px-3 font-bold">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        v.status === 'PUBLISHED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : v.status === 'SUBMITTED'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : v.status === 'REJECTED'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 max-w-xs truncate text-slate-300">{v.change_summary || '-'}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-400">{v.created_by}</td>
                  <td className="py-2.5 px-3 text-slate-500 font-mono text-xs">
                    {formatDateTime(v.created_at)}
                  </td>
                  <td className="py-2.5 px-3 text-right space-x-2">
                    <button
                      onClick={() => handleVersionChange(String(v.id))}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded text-[11px]"
                    >
                      Xem
                    </button>
                    {(hasRole('ADMIN') || (hasRole('MANAGER') || hasRole('SHIFT_LEADER'))) && (
                      <button
                        onClick={() => handleRestoreVersion(v)}
                        className="px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 font-bold rounded text-[11px]"
                      >
                        Khôi Phục
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUBMIT FOR APPROVAL MODAL */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-blue-400">
              <Send className="w-5 h-5" />
              <h3 className="font-bold text-white text-sm">Trình Phê Duyệt Sơ Đồ Topology Mới</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Tóm tắt các thay đổi *</label>
                <input
                  type="text"
                  required
                  value={changeSummary}
                  onChange={e => setChangeSummary(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder="VD: Bổ sung Recloser RCL-473-08 vào giữa phân đoạn 2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Lý do điều chỉnh phương thức *</label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder="VD: Đáp ứng tiêu chuẩn N-1 và nâng cao độ tin cậy cung cấp điện năm 2026..."
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleSaveTopology(true)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg"
              >
                Gửi Trình Phê Duyệt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERSION COMPARISON MODAL */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-purple-400">
                <GitCompare className="w-5 h-5" />
                <h3 className="font-bold text-white text-sm">So Sánh Khác Biệt Giữa 2 Phiên Bản Topology</h3>
              </div>
              <button onClick={() => setIsCompareModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selectors */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 mb-1">Phiên bản Gốc (Phiên bản A):</label>
                <select
                  value={compareVersionAId}
                  onChange={e => setCompareVersionAId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                >
                  {versions.map(v => (
                    <option key={v.id} value={v.id}>
                      v{v.version} ({v.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Phiên bản So Sánh (Phiên bản B):</label>
                <select
                  value={compareVersionBId}
                  onChange={e => setCompareVersionBId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                >
                  {versions.map(v => (
                    <option key={v.id} value={v.id}>
                      v{v.version} ({v.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleCompareVersions}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-lg"
            >
              Phân Tích Khác Biệt
            </button>

            {/* Comparison Diff Outcome */}
            {compareDiff && (
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800 text-xs">
                {/* Added Items */}
                <div className="p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-xl space-y-2">
                  <h4 className="font-bold text-emerald-400 uppercase text-[10px]">THÀNH PHẦN MỚI THÊM VÀO (ADDED)</h4>
                  <div>
                    <span className="font-bold text-slate-300 block mb-1">Nodes (Thiết bị):</span>
                    {compareDiff.addedNodes.length === 0 ? (
                      <span className="text-slate-500 italic">Không có</span>
                    ) : (
                      compareDiff.addedNodes.map(id => (
                        <span key={id} className="inline-block px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-mono rounded mr-1 mb-1">
                          + {id}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="pt-2">
                    <span className="font-bold text-slate-300 block mb-1">Edges (Đường dây):</span>
                    {compareDiff.addedEdges.length === 0 ? (
                      <span className="text-slate-500 italic">Không có</span>
                    ) : (
                      compareDiff.addedEdges.map((eStr, i) => (
                        <div key={i} className="text-emerald-300 font-mono text-[11px]">
                          + {eStr}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Removed Items */}
                <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl space-y-2">
                  <h4 className="font-bold text-red-400 uppercase text-[10px]">THÀNH PHẦN ĐÃ BỊ XÓA (REMOVED)</h4>
                  <div>
                    <span className="font-bold text-slate-300 block mb-1">Nodes (Thiết bị):</span>
                    {compareDiff.removedNodes.length === 0 ? (
                      <span className="text-slate-500 italic">Không có</span>
                    ) : (
                      compareDiff.removedNodes.map(id => (
                        <span key={id} className="inline-block px-2 py-0.5 bg-red-500/20 text-red-300 font-mono rounded mr-1 mb-1">
                          - {id}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="pt-2">
                    <span className="font-bold text-slate-300 block mb-1">Edges (Đường dây):</span>
                    {compareDiff.removedEdges.length === 0 ? (
                      <span className="text-slate-500 italic">Không có</span>
                    ) : (
                      compareDiff.removedEdges.map((eStr, i) => (
                        <div key={i} className="text-red-300 font-mono text-[11px]">
                          - {eStr}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
