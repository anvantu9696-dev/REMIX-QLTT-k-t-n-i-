import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Edge,
  Node,
  Controls,
  Background,
  useReactFlow,
  Handle,
  Position,
  NodeProps,
  ReactFlowProvider,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Zap,
  Radio,
  Power,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  Focus,
  Info,
  MapPin,
  ExternalLink,
  Layers,
  ArrowRight,
  X,
  SlidersHorizontal,
  RotateCcw,
  Edit,
  Trash2,
  Eye,
  Building2,
  Compass,
  AlertCircle,
  Calendar,
  Sparkles,
  Link as LinkIcon,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { GraphLegend } from './topology/GraphLegend';
import { api } from '../lib/api';
import dagre from 'dagre';
import { Loop, Device, Feeder, Substation } from '../types';
import { validateTopology, TopologyValidationReport } from '../lib/topologyValidator';
import { TopologyDiagnosticsModal } from './topology/TopologyDiagnosticsModal';

// Helper to navigate internally
const navigateTo = (path: string) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

// Compute Dagre Hierarchical Layout
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  
  // Adjust spacing dynamically based on node count for better layout
  const nodeCount = nodes.length;
  const rankSep = nodeCount > 7 ? 45 : 65;
  const nodeSep = nodeCount > 7 ? 30 : 45;
  
  g.setGraph({ rankdir: direction, ranksep: rankSep, nodesep: nodeSep });

  nodes.forEach((node) => {
    let width = 220;
    let height = 100;
    if (node.type === 'station_node') {
      width = 240;
      height = 125;
    } else if (node.type === 'loop_device_node') {
      width = 300;
      height = 230;
    } else if (node.type === 'feeder_node') {
      width = 220;
      height = 95;
    } else if (node.type === 'device_node') {
      width = 230;
      height = 115;
    } else if (node.type === 'missing_node') {
      width = 220;
      height = 95;
    }
    g.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id) || { x: 0, y: 0 };
    let offsetX = 110;
    let offsetY = 50;
    if (node.type === 'station_node') {
      offsetX = 120;
      offsetY = 62;
    } else if (node.type === 'loop_device_node') {
      offsetX = 150;
      offsetY = 115;
    } else if (node.type === 'feeder_node') {
      offsetX = 110;
      offsetY = 48;
    } else if (node.type === 'device_node') {
      offsetX = 115;
      offsetY = 58;
    } else if (node.type === 'missing_node') {
      offsetX = 110;
      offsetY = 48;
    }

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - offsetX,
        y: nodeWithPosition.y - offsetY,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// 1. Station Node Component (Trạm 110kV A hoặc B)
const StationNode = ({ data, selected }: NodeProps) => {
  const st = data as any;
  const isSideA = st.side === 'A';
  return (
    <div
      className={`bg-white border-2 rounded-xl p-3 shadow-md flex flex-col gap-1.5 min-w-[220px] max-w-[250px] cursor-pointer transition-all duration-200 ${
        selected ? 'border-amber-600 ring-4 ring-amber-100 shadow-xl' : 'border-amber-500 hover:border-amber-600 hover:shadow-lg'
      }`}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} className="!bg-amber-500 !w-3 !h-3" />
      <div className="flex items-center justify-between border-b border-amber-100 pb-1.5">
        <div className="flex items-center gap-1.5 text-amber-600">
          <div className="p-1 bg-amber-50 rounded">
            <Power size={15} className="stroke-[2.5]" />
          </div>
          <span className="font-bold text-[11px] uppercase tracking-wider">
            {st.side ? `Trạm 110kV (Phía ${st.side})` : 'Trạm 110kV'}
          </span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-50 text-amber-700 font-bold rounded border border-amber-200">
          {st.code || st.substation_code || 'TBA'}
        </span>
      </div>
      <div className="font-bold text-slate-900 text-xs leading-snug truncate" title={st.name || st.label}>
        {st.name || st.label || 'Trạm 110kV'}
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
        <span>Mã trạm: <strong className="font-mono text-slate-700">{st.substation_code || st.code || '-'}</strong></span>
        <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded font-semibold text-[9px]">Sẵn sàng</span>
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="!bg-amber-500 !w-3 !h-3" />
    </div>
  );
};

// 2. Feeder Node Component (Phát tuyến Phía A hoặc Phía B)
const FeederNode = ({ data, selected }: NodeProps) => {
  const f = data as any;
  return (
    <div
      className={`bg-white border-2 rounded-xl p-3 shadow-xs flex flex-col gap-1.5 min-w-[210px] max-w-[240px] cursor-pointer transition-all duration-200 ${
        selected ? 'border-blue-600 ring-4 ring-blue-100 shadow-lg' : 'border-blue-400 hover:border-blue-500 hover:shadow-md'
      }`}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} className="!bg-blue-500 !w-3 !h-3" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-blue-600">
          <div className="p-1 bg-blue-50 rounded">
            <Zap size={14} className="stroke-[2.5]" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide">
            {f.side ? `Phát Tuyến (${f.side})` : 'Phát Tuyến'}
          </span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded border border-blue-200 truncate max-w-[100px]">
          {f.feeder_code || f.code || 'PT'}
        </span>
      </div>
      <div className="font-semibold text-slate-900 text-xs leading-snug truncate" title={f.name || f.label}>
        {f.name || f.label || 'Phát tuyến'}
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
        <span className="truncate">Thuộc: <strong className="text-slate-700">{f.substation_name || '110kV'}</strong></span>
        <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded font-medium text-[9px]">22kV</span>
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
};

// 3. Device Node Component (Thiết bị đầu A / đầu B)
const DeviceNode = ({ data, selected }: NodeProps) => {
  const d = data as any;
  const isClosed = d.switch_status === 'CLOSED';
  const isOpen = d.switch_status === 'OPEN';

  return (
    <div
      className={`bg-white border-2 rounded-xl p-3 shadow-xs flex flex-col gap-1.5 min-w-[210px] max-w-[240px] cursor-pointer transition-all duration-200 ${
        selected ? 'border-emerald-600 ring-4 ring-emerald-100 shadow-lg' : 'border-slate-300 hover:border-emerald-500 hover:shadow-md'
      }`}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} className="!bg-emerald-500 !w-2.5 !h-2.5" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-slate-700">
          <div className="p-1 bg-emerald-50 text-emerald-700 rounded">
            <Radio size={13} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {d.side ? `Thiết Bị Đầu ${d.side}` : 'Thiết Bị Đầu'}
          </span>
        </div>
        <span
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
            isClosed
              ? 'bg-emerald-100 text-emerald-800'
              : isOpen
              ? 'bg-amber-100 text-amber-800'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          {isClosed ? 'ĐÓNG' : isOpen ? 'MỞ' : d.switch_status || 'K.X.Đ'}
        </span>
      </div>
      <div className="font-bold text-slate-900 text-xs leading-snug truncate" title={d.name || d.device_code || d.device_id}>
        {d.name || d.device_code || d.device_id || 'Thiết bị'}
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
        <span className="font-mono text-slate-600 font-semibold">{d.device_code || d.device_id || '-'}</span>
        <span className="text-slate-400 font-mono text-[9px]">{d.device_type || 'LBS'}</span>
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="!bg-emerald-500 !w-2.5 !h-2.5" />
    </div>
  );
};

// 4. MAIN LOOP DEVICE NODE (Điểm dừng pháp lý - Tâm điểm khép mạch)
const LoopDeviceNode = ({ data, selected }: NodeProps) => {
  const l = data as any;
  const loop = l.loop || {};
  const dev = l.device || {};

  const switchStatus = (dev.switch_status || loop.loop_device_switch_status || (loop.operation_status === 'CLOSED' || loop.operating_status === 'CLOSED' ? 'CLOSED' : 'OPEN')) === 'CLOSED' ? 'CLOSED' : 'OPEN';
  const isClosed = switchStatus === 'CLOSED';

  return (
    <div
      className={`relative bg-gradient-to-b from-white via-amber-50/40 to-indigo-50/50 border-2 rounded-2xl p-3.5 shadow-[0_0_25px_rgba(245,158,11,0.3)] flex flex-col gap-2.5 min-w-[280px] max-w-[320px] cursor-pointer transition-all duration-300 ${
        selected
          ? 'border-amber-500 ring-4 ring-amber-300 shadow-2xl scale-[1.03]'
          : 'border-amber-400 ring-2 ring-amber-300/40 hover:border-amber-500 hover:shadow-2xl'
      }`}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} className="!bg-amber-500 !w-3.5 !h-3.5 !border-2 !border-white" />

      {/* Header Banner - Prominent Highlight for Điểm Dừng Pháp Lý */}
      <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 text-white px-3 py-1.5 rounded-xl shadow-md border border-amber-200/40">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber-200 animate-spin-slow" />
          <span className="font-black text-[11px] uppercase tracking-wider text-amber-100">⭐ ĐIỂM DỪNG PHÁP LÝ ⭐</span>
        </div>
        <span className="text-[10px] font-mono font-bold bg-slate-950/80 text-amber-300 px-2 py-0.5 rounded border border-amber-400/50">
          {loop.loop_id || 'KV'}
        </span>
      </div>

      {/* Main Loop Device Information */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-bold text-amber-950 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-300">
            {loop.loop_device_code || dev.device_code || loop.loop_device_id || dev.device_id || 'LBS-KV'}
          </span>
          <span className="text-[10px] font-bold uppercase text-slate-500">
            Loại: <strong className="text-indigo-900">{loop.loop_device_type || dev.device_type || 'LBS'}</strong>
          </span>
        </div>
        <div className="font-bold text-slate-900 text-xs leading-snug mt-0.5">
          {loop.name || 'Mạch Khép Vòng'}
        </div>
      </div>

      {/* Status: Trạng thái đóng cắt (Ẩn trạng thái vận hành) */}
      <div className="bg-white p-2 rounded-xl border border-amber-200/80 shadow-2xs text-[10px]">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 font-medium">Trạng thái đóng cắt:</span>
          <span
            className={`font-bold px-2.5 py-0.5 rounded text-[10px] inline-flex items-center gap-1 ${
              isClosed
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-rose-100 text-rose-800 border border-rose-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isClosed ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            {isClosed ? 'ĐÓNG (Closed)' : 'MỞ (Open)'}
          </span>
        </div>
      </div>

      {/* Pole & Location */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
        <span className="flex items-center gap-1">
          <MapPin size={11} className="text-rose-500 shrink-0" />
          <span className="truncate">Trụ: <strong className="text-slate-800 font-mono">{loop.loop_device_pole || dev.pole_number || 'N/A'}</strong></span>
        </span>
        <span className="truncate text-slate-600">{loop.loop_device_team || dev.team || 'Đội QLVH'}</span>
      </div>

      <Handle type="source" position={Position.Bottom} isConnectable={false} className="!bg-indigo-600 !w-3.5 !h-3.5 !border-2 !border-white" />
    </div>
  );
};

// 5. MISSING / INCOMPLETE FIELD NODE (Báo rõ trường còn thiếu, không tạo dữ liệu giả)
const MissingNode = ({ data, selected }: NodeProps) => {
  const m = data as any;
  return (
    <div
      className={`bg-amber-50/90 border-2 border-dashed border-amber-400 rounded-xl p-3 shadow-xs flex flex-col gap-1.5 min-w-[210px] max-w-[240px] cursor-pointer transition-all duration-200 ${
        selected ? 'border-amber-600 ring-4 ring-amber-100' : 'hover:border-amber-500'
      }`}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} className="!bg-amber-400 !w-2.5 !h-2.5" />
      <div className="flex items-center justify-between text-amber-700">
        <div className="flex items-center gap-1 font-bold text-[10px] uppercase tracking-wide">
          <AlertTriangle size={13} className="text-amber-600" />
          <span>{m.fieldTitle || 'Thiếu dữ liệu'}</span>
        </div>
        <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded font-bold text-[9px]">Cần bổ sung</span>
      </div>
      <div className="text-amber-900 font-medium text-xs leading-snug">
        {m.description || 'Chưa cấu hình trường này trong CSDL'}
      </div>
      <div className="text-[10px] text-amber-700 font-semibold pt-1 border-t border-amber-200 flex items-center justify-between">
        <span>Khép vòng: {m.loop_id}</span>
        <span className="text-indigo-600 font-bold underline">Bổ sung</span>
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="!bg-amber-400 !w-2.5 !h-2.5" />
    </div>
  );
};

const nodeTypes = {
  station_node: StationNode,
  feeder_node: FeederNode,
  device_node: DeviceNode,
  loop_device_node: LoopDeviceNode,
  missing_node: MissingNode,
};

export function DynamicGraphInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loops, setLoops] = useState<Loop[]>([]);
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [feeders, setFeeders] = useState<Feeder[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLoopId, setSelectedLoopId] = useState<string>('ALL');
  const [filterStationId, setFilterStationId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mode, setMode] = useState<'Overview' | 'Detailed'>('Detailed');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  // Modals for CRUD operations directly from Graph
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeLoopForAction, setActiveLoopForAction] = useState<Loop | null>(null);

  // Form states for Create/Edit
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
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filtered dropdowns for modal
  const [modalFeedersA, setModalFeedersA] = useState<Feeder[]>([]);
  const [modalDevicesA, setModalDevicesA] = useState<Device[]>([]);
  const [modalFeedersB, setModalFeedersB] = useState<Feeder[]>([]);
  const [modalDevicesB, setModalDevicesB] = useState<Device[]>([]);

  // Topology Diagnostics Modal
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);
  const [diagnosticsReport, setDiagnosticsReport] = useState<TopologyValidationReport | null>(null);

  const handleOpenDiagnostics = (loopToValidate: Loop) => {
    const report = validateTopology({
      loop: loopToValidate,
      allDevices: devices,
      allFeeders: feeders,
      allSubstations: substations,
      allLoops: loops
    });
    setDiagnosticsReport(report);
    setActiveLoopForAction(loopToValidate);
    setIsDiagnosticsModalOpen(true);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const { fitView, zoomIn, zoomOut, setViewport } = useReactFlow();
  const [viewportState, setViewportState] = useState({ x: 0, y: 0, zoom: 1 });
  const [showSlidersPanel, setShowSlidersPanel] = useState(true);
  const [isPanMode, setIsPanMode] = useState(false);

  // Load Loops as primary source of truth
  const loadLoopsAndTopology = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loopsRes, substationsRes, feedersRes, devicesRes] = await Promise.all([
        api.getLoops(),
        api.getSubstations(),
        api.getFeeders(),
        api.getDevices({ limit: 1000 })
      ]);

      const loadedLoops: Loop[] = loopsRes.data || [];
      const loadedSubstations: Substation[] = substationsRes.data || [];
      const loadedFeeders: Feeder[] = feedersRes.data || [];
      const loadedDevices: Device[] = devicesRes.data || [];

      setLoops(loadedLoops);
      setSubstations(loadedSubstations);
      setFeeders(loadedFeeders);
      setDevices(loadedDevices);
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu khép vòng từ cơ sở dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLoopsAndTopology();
  }, [loadLoopsAndTopology]);

  // Build Topology strictly from database Loop records
  // Path: Trạm A -> Tuyến A -> Thiết bị A -> Thiết bị Khép vòng -> Thiết bị B -> Tuyến B -> Trạm B
  const buildGraphElements = useCallback(() => {
    if (loops.length === 0) {
      return { nodes: [], edges: [] };
    }

    const stationMap = new Map<string, Substation>();
    substations.forEach(s => {
      stationMap.set(String(s.id), s);
      if (s.substation_code) stationMap.set(String(s.substation_code), s);
    });

    const feederMap = new Map<string, Feeder>();
    feeders.forEach(f => {
      feederMap.set(String(f.id), f);
      if (f.feeder_code) feederMap.set(String(f.feeder_code), f);
    });

    const deviceMap = new Map<string, Device>();
    devices.forEach(d => {
      deviceMap.set(String(d.id), d);
      if (d.device_id) deviceMap.set(String(d.device_id), d);
      if (d.device_code) deviceMap.set(String(d.device_code), d);
    });

    // Filter loops based on selected loop or station
    let targetLoops = [...loops];
    if (selectedLoopId !== 'ALL') {
      targetLoops = targetLoops.filter(l => String(l.id) === String(selectedLoopId) || l.loop_id === selectedLoopId);
    }
    if (filterStationId !== 'ALL') {
      const stId = Number(filterStationId);
      targetLoops = targetLoops.filter(l => l.substation_id_a === stId || l.substation_id_b === stId);
    }

    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    targetLoops.forEach((loop, loopIdx) => {
      const loopKey = `L${loop.id}`;

      // 1. Station A Node
      let stA = loop.substation_id_a ? stationMap.get(String(loop.substation_id_a)) : null;
      const stANodeId = `node-stA-${loopKey}`;
      if (stA || loop.substation_name_a) {
        generatedNodes.push({
          id: stANodeId,
          type: 'station_node',
          position: { x: 0, y: 0 },
          data: {
            id: stA?.id || loop.substation_id_a,
            name: loop.substation_name_a || stA?.name || 'Trạm 110kV A',
            code: loop.substation_code_a || stA?.substation_code || 'TBA-A',
            substation_code: loop.substation_code_a || stA?.substation_code,
            side: 'A',
            loop_id: loop.loop_id,
            loopRef: loop,
          },
        });
      } else {
        generatedNodes.push({
          id: stANodeId,
          type: 'missing_node',
          position: { x: 0, y: 0 },
          data: {
            fieldTitle: 'Thiếu Trạm 110kV A',
            description: 'Khép vòng chưa được gán Trạm nguồn A',
            loop_id: loop.loop_id,
            loopRef: loop,
          },
        });
      }

      // 2. Feeder A Node
      let fA = loop.feeder_id_a ? feederMap.get(String(loop.feeder_id_a)) : null;
      const fANodeId = `node-fA-${loopKey}`;
      if (fA || loop.feeder_name_a || loop.feeder_code_a) {
        generatedNodes.push({
          id: fANodeId,
          type: 'feeder_node',
          position: { x: 0, y: 0 },
          data: {
            id: fA?.id || loop.feeder_id_a,
            name: loop.feeder_name_a || fA?.name || 'Phát tuyến A',
            code: loop.feeder_code_a || fA?.feeder_code || 'PT-A',
            feeder_code: loop.feeder_code_a || fA?.feeder_code || 'PT-A',
            substation_name: loop.substation_name_a || stA?.name,
            side: 'A',
            loop_id: loop.loop_id,
            loopRef: loop,
          },
        });
      } else {
        generatedNodes.push({
          id: fANodeId,
          type: 'missing_node',
          position: { x: 0, y: 0 },
          data: {
            fieldTitle: 'Thiếu Phát tuyến A',
            description: 'Khép vòng chưa cấu hình phát tuyến nguồn A',
            loop_id: loop.loop_id,
            loopRef: loop,
          },
        });
      }

      // Edge: Station A -> Feeder A
      generatedEdges.push({
        id: `edge-stA-fA-${loopKey}`,
        source: stANodeId,
        target: fANodeId,
        animated: true,
        style: { stroke: '#f59e0b', strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
      });

      // 3. Device A Node (Only in Detailed Mode)
      const devANodeId = `node-devA-${loopKey}`;
      let devA = loop.device_id_a ? deviceMap.get(String(loop.device_id_a)) : null;
      if (mode === 'Detailed') {
        if (devA || loop.device_id_a) {
          generatedNodes.push({
            id: devANodeId,
            type: 'device_node',
            position: { x: 0, y: 0 },
            data: {
              id: devA?.id,
              device_id: loop.device_id_a || devA?.device_id,
              device_code: loop.device_code_a || devA?.device_code || loop.device_id_a,
              name: loop.device_name_a || devA?.name || loop.device_id_a,
              device_type: loop.device_type_a || devA?.device_type || 'LBS',
              switch_status: loop.switch_status_a || devA?.switch_status || 'CLOSED',
              side: 'A',
              loop_id: loop.loop_id,
              loopRef: loop,
            },
          });
        } else {
          generatedNodes.push({
            id: devANodeId,
            type: 'missing_node',
            position: { x: 0, y: 0 },
            data: {
              fieldTitle: 'Thiếu Thiết bị đầu A',
              description: 'Chưa chỉ định thiết bị phân đoạn phía A',
              loop_id: loop.loop_id,
              loopRef: loop,
            },
          });
        }

        // Edge: Feeder A -> Device A
        generatedEdges.push({
          id: `edge-fA-devA-${loopKey}`,
          source: fANodeId,
          target: devANodeId,
          animated: true,
          style: { stroke: '#3b82f6', strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
        });
      }

      // 4. MAIN LOOP DEVICE NODE (Centerpiece)
      const loopDeviceNodeId = `node-loopMain-${loopKey}`;
      let mainLoopDev = loop.loop_device_id ? deviceMap.get(String(loop.loop_device_id)) : null;
      if (loop.loop_device_id || loop.loop_device_code) {
        generatedNodes.push({
          id: loopDeviceNodeId,
          type: 'loop_device_node',
          position: { x: 0, y: 0 },
          data: {
            loop: loop,
            device: mainLoopDev,
            loop_id: loop.loop_id,
            name: loop.name,
            loopRef: loop,
          },
        });
      } else {
        generatedNodes.push({
          id: loopDeviceNodeId,
          type: 'missing_node',
          position: { x: 0, y: 0 },
          data: {
            fieldTitle: 'Thiếu Điểm dừng pháp lý',
            description: 'Chưa chỉ định Điểm dừng pháp lý (Vật lý)',
            loop_id: loop.loop_id,
            loopRef: loop,
          },
        });
      }

      // Edge: (Device A or Feeder A) -> Main Loop Device
      const sideASource = mode === 'Detailed' ? devANodeId : fANodeId;
      generatedEdges.push({
        id: `edge-sideA-main-${loopKey}`,
        source: sideASource,
        target: loopDeviceNodeId,
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 3 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
      });

      // 5. Device B Node (Only in Detailed Mode)
      const devBNodeId = `node-devB-${loopKey}`;
      let devB = loop.device_id_b ? deviceMap.get(String(loop.device_id_b)) : null;
      if (mode === 'Detailed') {
        if (devB || loop.device_id_b) {
          generatedNodes.push({
            id: devBNodeId,
            type: 'device_node',
            position: { x: 0, y: 0 },
            data: {
              id: devB?.id,
              device_id: loop.device_id_b || devB?.device_id,
              device_code: loop.device_code_b || devB?.device_code || loop.device_id_b,
              name: loop.device_name_b || devB?.name || loop.device_id_b,
              device_type: loop.device_type_b || devB?.device_type || 'LBS',
              switch_status: loop.switch_status_b || devB?.switch_status || 'CLOSED',
              side: 'B',
              loop_id: loop.loop_id,
              loopRef: loop,
            },
          });
        } else {
          generatedNodes.push({
            id: devBNodeId,
            type: 'missing_node',
            position: { x: 0, y: 0 },
            data: {
              fieldTitle: 'Thiếu Thiết bị đầu B',
              description: 'Chưa chỉ định thiết bị phân đoạn phía B',
              loop_id: loop.loop_id,
              loopRef: loop,
            },
          });
        }

        // Edge: Main Loop Device -> Device B
        generatedEdges.push({
          id: `edge-main-devB-${loopKey}`,
          source: loopDeviceNodeId,
          target: devBNodeId,
          animated: true,
          style: { stroke: '#6366f1', strokeWidth: 3 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
        });
      }

      // 6. Feeder B Node
      let fB = loop.feeder_id_b ? feederMap.get(String(loop.feeder_id_b)) : null;
      const fBNodeId = `node-fB-${loopKey}`;
      if (fB || loop.feeder_name_b || loop.feeder_code_b) {
        generatedNodes.push({
          id: fBNodeId,
          type: 'feeder_node',
          position: { x: 0, y: 0 },
          data: {
            id: fB?.id || loop.feeder_id_b,
            name: loop.feeder_name_b || fB?.name || 'Phát tuyến B',
            code: loop.feeder_code_b || fB?.feeder_code || 'PT-B',
            feeder_code: loop.feeder_code_b || fB?.feeder_code || 'PT-B',
            substation_name: loop.substation_name_b || stationMap.get(String(loop.substation_id_b))?.name,
            side: 'B',
            loop_id: loop.loop_id,
            loopRef: loop,
          },
        });
      } else {
        generatedNodes.push({
          id: fBNodeId,
          type: 'missing_node',
          position: { x: 0, y: 0 },
          data: {
            fieldTitle: 'Thiếu Phát tuyến B',
            description: 'Khép vòng chưa cấu hình phát tuyến nguồn B',
            loop_id: loop.loop_id,
            loopRef: loop,
          },
        });
      }

      // Edge: (Device B or Main Loop Device) -> Feeder B
      const sideBTargetSource = mode === 'Detailed' ? devBNodeId : loopDeviceNodeId;
      generatedEdges.push({
        id: `edge-sideB-fB-${loopKey}`,
        source: sideBTargetSource,
        target: fBNodeId,
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
      });

      // 7. Station B Node
      let stB = loop.substation_id_b ? stationMap.get(String(loop.substation_id_b)) : null;
      const stBNodeId = `node-stB-${loopKey}`;
      if (stB || loop.substation_name_b) {
        generatedNodes.push({
          id: stBNodeId,
          type: 'station_node',
          position: { x: 0, y: 0 },
          data: {
            id: stB?.id || loop.substation_id_b,
            name: loop.substation_name_b || stB?.name || 'Trạm 110kV B',
            code: loop.substation_code_b || stB?.substation_code || 'TBA-B',
            substation_code: loop.substation_code_b || stB?.substation_code,
            side: 'B',
            loop_id: loop.loop_id,
            loopRef: loop,
          },
        });
      } else {
        generatedNodes.push({
          id: stBNodeId,
          type: 'missing_node',
          position: { x: 0, y: 0 },
          data: {
            fieldTitle: 'Thiếu Trạm 110kV B',
            description: 'Khép vòng chưa được gán Trạm nguồn B',
            loop_id: loop.loop_id,
            loopRef: loop,
          },
        });
      }

      // Edge: Feeder B -> Station B
      generatedEdges.push({
        id: `edge-fB-stB-${loopKey}`,
        source: fBNodeId,
        target: stBNodeId,
        animated: true,
        style: { stroke: '#f59e0b', strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
      });
    });

    return { nodes: generatedNodes, edges: generatedEdges };
  }, [loops, substations, feeders, devices, selectedLoopId, filterStationId, mode]);

  // Update layout and graph elements whenever filters or data change
  useEffect(() => {
    if (loading || error) return;

    const { nodes: rawNodes, edges: rawEdges } = buildGraphElements();

    // Search query filter highlighting
    let processedNodes = rawNodes;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      processedNodes = processedNodes.map(n => {
        const d = n.data as any;
        const name = String(d.name || d.fieldTitle || '').toLowerCase();
        const code = String(d.code || d.substation_code || d.feeder_code || d.device_code || d.device_id || d.loop_id || '').toLowerCase();
        const match = name.includes(q) || code.includes(q);
        return {
          ...n,
          style: {
            ...n.style,
            opacity: match ? 1 : 0.2,
            transition: 'opacity 0.25s ease',
          },
        };
      });
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(processedNodes, rawEdges, 'TB');
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    setTimeout(() => {
      const isMobile = window.innerWidth < 768;
      fitView({ duration: 500, padding: isMobile ? 0.12 : 0.18 });
    }, 80);
  }, [buildGraphElements, searchQuery, loading, error, fitView, setNodes, setEdges]);

  // Fit to View action
  const handleFitToView = useCallback(() => {
    const isMobile = window.innerWidth < 768;
    fitView({
      padding: isMobile ? 0.12 : 0.2,
      duration: 500,
    });
  }, [fitView]);

  // Auto Layout action
  const handleReLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, 'TB');
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    setTimeout(() => {
      handleFitToView();
    }, 60);
  }, [nodes, edges, setNodes, setEdges, handleFitToView]);

  // ===================== CRUD OPERATIONS DIRECTLY FROM GRAPH =====================

  // Open Create Modal
  const handleOpenCreateModal = () => {
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
    setModalFeedersA([]);
    setModalDevicesA([]);
    setModalFeedersB([]);
    setModalDevicesB([]);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal from Active Selected Loop
  const handleOpenEditModal = async (loopToEdit: Loop) => {
    setActiveLoopForAction(loopToEdit);
    setFormError(null);
    setFormData({
      loop_id: loopToEdit.loop_id,
      name: loopToEdit.name,
      substation_id_a: String(loopToEdit.substation_id_a || ''),
      feeder_id_a: String(loopToEdit.feeder_id_a || ''),
      device_id_a: String(loopToEdit.device_id_a || ''),
      loop_device_id: String(loopToEdit.loop_device_id || ''),
      substation_id_b: String(loopToEdit.substation_id_b || ''),
      feeder_id_b: String(loopToEdit.feeder_id_b || ''),
      device_id_b: String(loopToEdit.device_id_b || ''),
      latitude: loopToEdit.latitude !== undefined && loopToEdit.latitude !== null ? String(loopToEdit.latitude) : '',
      longitude: loopToEdit.longitude !== undefined && loopToEdit.longitude !== null ? String(loopToEdit.longitude) : '',
      google_maps_url: loopToEdit.google_maps_url || '',
      configuration_status: loopToEdit.configuration_status || loopToEdit.config_status || loopToEdit.status || 'ACTIVE',
      operation_status: loopToEdit.operation_status || loopToEdit.operating_status || 'OPEN',
      inspection_cycle: loopToEdit.inspection_cycle || 'MONTHLY',
      status: loopToEdit.status || 'ACTIVE',
      notes: loopToEdit.notes || ''
    });

    if (loopToEdit.substation_id_a) {
      const res = await api.getFeeders({ substation_id: String(loopToEdit.substation_id_a) });
      if (res.success) setModalFeedersA(res.data.filter((f: any) => f.status !== 'INACTIVE'));
    }
    if (loopToEdit.feeder_id_a) {
      const res = await api.getDevices({ feeder_id: String(loopToEdit.feeder_id_a), limit: 500 });
      if (res.success) setModalDevicesA(res.data.filter((d: any) => d.status !== 'INACTIVE'));
    }
    if (loopToEdit.substation_id_b) {
      const res = await api.getFeeders({ substation_id: String(loopToEdit.substation_id_b) });
      if (res.success) setModalFeedersB(res.data.filter((f: any) => f.status !== 'INACTIVE'));
    }
    if (loopToEdit.feeder_id_b) {
      const res = await api.getDevices({ feeder_id: String(loopToEdit.feeder_id_b), limit: 500 });
      if (res.success) setModalDevicesB(res.data.filter((d: any) => d.status !== 'INACTIVE'));
    }

    setIsEditModalOpen(true);
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (loopToDelete: Loop) => {
    setActiveLoopForAction(loopToDelete);
    setDeleteError(null);
    setIsDeleting(false);
    setIsDeleteModalOpen(true);
  };

  // Cascade station change for Side A
  const handleModalStationAChange = async (stationId: string) => {
    setFormData(prev => ({ ...prev, substation_id_a: stationId, feeder_id_a: '', device_id_a: '' }));
    setModalDevicesA([]);
    if (stationId) {
      const res = await api.getFeeders({ substation_id: stationId });
      if (res.success) setModalFeedersA(res.data.filter((f: any) => f.status !== 'INACTIVE'));
    } else {
      setModalFeedersA([]);
    }
  };

  // Cascade feeder change for Side A
  const handleModalFeederAChange = async (feederId: string) => {
    setFormData(prev => ({ ...prev, feeder_id_a: feederId, device_id_a: '' }));
    if (feederId) {
      const res = await api.getDevices({ feeder_id: feederId, limit: 500 });
      if (res.success) setModalDevicesA(res.data.filter((d: any) => d.status !== 'INACTIVE'));
    } else {
      setModalDevicesA([]);
    }
  };

  // Cascade station change for Side B
  const handleModalStationBChange = async (stationId: string) => {
    setFormData(prev => ({ ...prev, substation_id_b: stationId, feeder_id_b: '', device_id_b: '' }));
    setModalDevicesB([]);
    if (stationId) {
      const res = await api.getFeeders({ substation_id: stationId });
      if (res.success) setModalFeedersB(res.data.filter((f: any) => f.status !== 'INACTIVE'));
    } else {
      setModalFeedersB([]);
    }
  };

  // Cascade feeder change for Side B
  const handleModalFeederBChange = async (feederId: string) => {
    setFormData(prev => ({ ...prev, feeder_id_b: feederId, device_id_b: '' }));
    if (feederId) {
      const res = await api.getDevices({ feeder_id: feederId, limit: 500 });
      if (res.success) setModalDevicesB(res.data.filter((d: any) => d.status !== 'INACTIVE'));
    } else {
      setModalDevicesB([]);
    }
  };

  // Main Loop Device selection auto-fill
  const handleModalLoopDeviceSelect = (deviceId: string) => {
    setFormData(prev => ({ ...prev, loop_device_id: deviceId }));
    if (deviceId) {
      const dev = devices.find(d => String(d.id) === String(deviceId) || d.device_id === deviceId);
      if (dev) {
        setFormData(prev => ({
          ...prev,
          latitude: dev.latitude !== undefined && dev.latitude !== null ? String(dev.latitude) : prev.latitude,
          longitude: dev.longitude !== undefined && dev.longitude !== null ? String(dev.longitude) : prev.longitude,
          google_maps_url: dev.google_maps_url || prev.google_maps_url,
          operation_status: dev.switch_status === 'CLOSED' ? 'CLOSED' : 'OPEN',
        }));
      }
    }
  };

  // Save Loop (Create / Update) and Auto-Refresh Graph
  const handleSaveLoopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

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
      setFormError('Vui lòng điền đầy đủ các trường thông tin bắt buộc.');
      return;
    }

    if (String(formData.feeder_id_a) === String(formData.feeder_id_b)) {
      setFormError('Phát tuyến phía A và phát tuyến phía B không được giống nhau.');
      return;
    }

    if (String(formData.device_id_a).trim() === String(formData.device_id_b).trim()) {
      setFormError('Thiết bị đầu A và thiết bị đầu B không được giống nhau.');
      return;
    }

    setIsSaving(true);
    try {
      if (isEditModalOpen && activeLoopForAction) {
        const res = await api.updateLoop(activeLoopForAction.id, formData);
        if (res.success) {
          setIsEditModalOpen(false);
          await loadLoopsAndTopology();
          setSelectedNode(null);
        }
      } else {
        const res = await api.createLoop(formData);
        if (res.success) {
          setIsCreateModalOpen(false);
          await loadLoopsAndTopology();
          setSelectedLoopId(String(res.loopId));
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Thao tác lưu khép vòng thất bại.');
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm Delete Loop and Auto-Refresh Graph
  const handleConfirmDelete = async () => {
    if (!activeLoopForAction) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await api.deleteLoop(activeLoopForAction.id);
      if (res.success) {
        setIsDeleteModalOpen(false);
        setActiveLoopForAction(null);
        setSelectedNode(null);
        await loadLoopsAndTopology();
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Không thể xóa khép vòng.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Active loop reference from selected node
  const currentSelectedLoop: Loop | null = useMemo(() => {
    if (!selectedNode) return null;
    const d = selectedNode.data as any;
    if (d.loopRef) return d.loopRef;
    if (d.loop) return d.loop;
    if (d.loop_id) {
      return loops.find(l => l.loop_id === d.loop_id) || null;
    }
    return null;
  }, [selectedNode, loops]);

  if (loading) {
    return (
      <div className="w-full h-[540px] sm:h-[700px] border border-slate-200 rounded-2xl flex flex-col items-center justify-center bg-slate-50 text-slate-500 p-4 text-center">
        <Loader2 className="animate-spin w-10 h-10 mb-4 text-indigo-600" />
        <p className="font-bold text-slate-800 text-sm">Đang tải cấu trúc Khép Vòng từ Cơ sở Dữ liệu...</p>
        <span className="text-xs text-slate-400 mt-1">Đồng bộ Trạm A → Tuyến A → Thiết bị A → Thiết bị Khép vòng → Thiết bị B → Tuyến B → Trạm B</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[540px] sm:h-[700px] border border-rose-200 rounded-2xl flex flex-col items-center justify-center bg-rose-50/50 text-rose-600 p-6 text-center">
        <AlertTriangle className="w-12 h-12 mb-3 text-rose-500" />
        <h3 className="text-base font-bold mb-1">Lỗi tải dữ liệu sơ đồ khép vòng</h3>
        <p className="max-w-md mb-5 text-xs text-slate-600">{error}</p>
        <button
          onClick={loadLoopsAndTopology}
          className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-rose-700 transition-colors"
        >
          Tải lại sơ đồ
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen bg-slate-900/5'
          : 'h-[calc(100vh-140px)] min-h-[540px] max-h-[890px] sm:h-[760px] border border-slate-200 rounded-2xl bg-slate-900/5 shadow-inner'
      }`}
    >
      {/* ======================= TOP CONTROLS & FILTER BAR ======================= */}
      <div className="absolute top-3 inset-x-3 sm:inset-x-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Left: Loop Selector & Station Filter & Create Button */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-lg border border-slate-200/90">
          
          {/* Loop Selector Dropdown */}
          <div className="flex items-center gap-1.5 pl-1.5">
            <RefreshCw size={14} className="text-indigo-600 animate-spin-slow shrink-0" />
            <select
              value={selectedLoopId}
              onChange={(e) => setSelectedLoopId(e.target.value)}
              className="py-1.5 px-2 text-xs font-bold bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[220px] truncate"
            >
              <option value="ALL">🌐 Tất cả Mạch Khép Vòng ({loops.length})</option>
              {loops.map(l => (
                <option key={l.id} value={String(l.id)}>
                  {l.loop_id} - {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Station */}
          <select
            value={filterStationId}
            onChange={(e) => setFilterStationId(e.target.value)}
            className="hidden md:block py-1.5 px-2 text-xs font-semibold bg-slate-100 border border-slate-200 rounded-xl text-slate-800 cursor-pointer"
          >
            <option value="ALL">Tất cả Trạm 110kV ({substations.length})</option>
            {substations.map(st => (
              <option key={st.id} value={String(st.id)}>
                {st.name} ({st.substation_code || 'TBA'})
              </option>
            ))}
          </select>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setMode('Detailed')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                mode === 'Detailed' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Sơ đồ 7 nút: Trạm A → Tuyến A → Thiết bị A → Khép vòng → Thiết bị B → Tuyến B → Trạm B"
            >
              Chi tiết (7 nút)
            </button>
            <button
              onClick={() => setMode('Overview')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                mode === 'Overview' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Sơ đồ tổng quan: Trạm A → Tuyến A → Khép vòng → Tuyến B → Trạm B"
            >
              Tổng quan
            </button>
          </div>

          {/* Search Box */}
          <div className="relative hidden lg:block">
            <input
              type="text"
              placeholder="Tìm trạm, tuyến, LBS, mã KV..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-6 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 w-44 font-medium"
            />
            <Search size={12} className="text-slate-400 absolute left-2.5 top-2.5" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Button: + Tạo Khép Vòng Mới */}
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            title="Tạo Mạch Khép Vòng Mới"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Tạo Khép Vòng</span>
          </button>
        </div>

        {/* Right: Quick Tools */}
        <div className="flex items-center gap-1.5 pointer-events-auto bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-lg border border-slate-200/90">
          <button
            onClick={() => setIsLegendOpen(!isLegendOpen)}
            className={`p-2 rounded-xl text-xs font-bold transition-all ${
              isLegendOpen ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Xem chú thích sơ đồ"
          >
            <HelpCircle size={15} />
          </button>

          <button
            onClick={loadLoopsAndTopology}
            className="p-2 text-slate-700 hover:bg-slate-100 rounded-xl text-xs transition-all"
            title="Làm mới dữ liệu từ Database"
          >
            <RefreshCw size={15} />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-slate-700 hover:bg-slate-100 rounded-xl text-xs transition-all"
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* ======================= LEGEND POPUP OVERLAY ======================= */}
      {isLegendOpen && (
        <div className="absolute top-16 right-4 z-30 max-w-xs animate-in fade-in slide-in-from-top-2 pointer-events-auto">
          <div className="relative">
            <button
              onClick={() => setIsLegendOpen(false)}
              className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-700 rounded-full bg-slate-100"
            >
              <X size={14} />
            </button>
            <GraphLegend />
          </div>
        </div>
      )}

      {/* ======================= BOTTOM FLOATING ZOOM & FIT CONTROLS ======================= */}
      <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-slate-200/90 pointer-events-auto">
        <button
          onClick={handleFitToView}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
          title="Căn chỉnh vừa màn hình (Fit to View)"
        >
          <Focus size={15} />
          <span className="whitespace-nowrap">Vừa màn hình</span>
        </button>

        <button
          onClick={() => zoomIn({ duration: 200 })}
          className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
          title="Phóng to (+)"
        >
          <Plus size={15} />
        </button>

        <button
          onClick={() => zoomOut({ duration: 200 })}
          className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
          title="Thu nhỏ (-)"
        >
          <Minus size={15} />
        </button>

        <button
          onClick={handleReLayout}
          className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          title="Sắp xếp tự động lại vị trí các nút"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* ======================= SIDE PANEL: OBJECT DETAILS & LOOP ACTIONS ======================= */}
      {selectedNode && (
        <>
          <div
            onClick={() => setSelectedNode(null)}
            className="sm:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs"
          />

          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[82vh] bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 overflow-y-auto flex flex-col sm:fixed-none sm:absolute sm:inset-auto sm:top-16 sm:right-4 sm:z-20 sm:w-88 sm:max-h-[660px] sm:rounded-2xl sm:border sm:border-slate-200 animate-in fade-in slide-in-from-bottom sm:slide-in-from-right-4 duration-200">
            {/* Header */}
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between rounded-t-2xl sticky top-0 z-10 shadow-md">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-indigo-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  {selectedNode.type === 'loop_device_node'
                    ? 'Hồ sơ Thiết bị Khép vòng'
                    : selectedNode.type === 'station_node'
                    ? 'Thông tin Trạm 110kV'
                    : selectedNode.type === 'feeder_node'
                    ? 'Thông tin Phát tuyến'
                    : selectedNode.type === 'missing_node'
                    ? 'Cảnh báo Dữ liệu'
                    : 'Hồ sơ Thiết bị Phân đoạn'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3.5 text-xs pb-6">
              {/* Object Name */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Tên phần tử</span>
                <div className="font-bold text-slate-900 text-sm mt-0.5">
                  {String(selectedNode.data.name || selectedNode.data.fieldTitle || selectedNode.data.label || 'Chưa đặt tên')}
                </div>
              </div>

              {/* Loop Specific Context & Primary Actions */}
              {currentSelectedLoop && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-indigo-900">Mạch Khép Vòng</span>
                    <span className="font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200 text-xs">
                      {currentSelectedLoop.loop_id}
                    </span>
                  </div>
                  <div className="font-bold text-slate-900 text-xs leading-snug">
                    {currentSelectedLoop.name}
                  </div>

                  {/* Operation & Config Status Badges */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-indigo-100">
                    <div>
                      <span className="text-slate-500 font-medium block">Vận hành:</span>
                      <strong className={currentSelectedLoop.operation_status === 'CLOSED' ? 'text-emerald-700' : 'text-amber-600'}>
                        {currentSelectedLoop.operation_status === 'CLOSED' ? '🟢 Khép Vòng' : '🟡 Mở Vòng'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Cấu hình:</span>
                      <strong className="text-blue-700">
                        {currentSelectedLoop.configuration_status || currentSelectedLoop.config_status || 'ACTIVE'}
                      </strong>
                    </div>
                  </div>

                  {/* 3 MANDATORY ACTION BUTTONS: VIEW / EDIT / DELETE */}
                  <div className="pt-2 border-t border-indigo-200/80 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {/* View Details */}
                      <button
                        onClick={() => navigateTo(`/loops/${currentSelectedLoop.id}`)}
                        className="flex-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs transition-colors"
                        title="Xem chi tiết sơ đồ & lịch sử phiên bản"
                      >
                        <Eye size={12} />
                        <span>Xem</span>
                      </button>

                      {/* Edit Loop */}
                      <button
                        onClick={() => handleOpenEditModal(currentSelectedLoop)}
                        className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs transition-colors"
                        title="Chỉnh sửa thông tin khép vòng"
                      >
                        <Edit size={12} />
                        <span>Sửa</span>
                      </button>

                      {/* Delete Loop */}
                      <button
                        onClick={() => handleOpenDeleteModal(currentSelectedLoop)}
                        className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                        title="Xóa mạch khép vòng"
                      >
                        <Trash2 size={12} />
                        <span>Xóa</span>
                      </button>
                    </div>

                    {/* Topology Diagnostic Check Button */}
                    <button
                      onClick={() => handleOpenDiagnostics(currentSelectedLoop)}
                      className="w-full py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      title="Kiểm tra lỗi và tính toàn vẹn 7 nút của Topology"
                    >
                      <ShieldCheck size={13} className="text-emerald-400" />
                      <span>Kiểm tra lỗi Topology</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Side A & Side B Connection Summary */}
              {currentSelectedLoop && (
                <div className="flex flex-col gap-2 border-t border-slate-100 pt-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Cấu trúc kết nối 7 nút</span>

                  {/* Phía A */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>Phía A (Nguồn A)</span>
                    </div>
                    <div className="text-slate-600 pl-3.5 space-y-0.5 text-[10px]">
                      <div>Trạm: <strong>{currentSelectedLoop.substation_name_a || 'Chưa gán'}</strong> ({currentSelectedLoop.substation_code_a || '-'})</div>
                      <div>Phát tuyến: <strong>{currentSelectedLoop.feeder_code_a || 'Chưa gán'}</strong></div>
                      <div>Thiết bị đầu A: <span className="font-mono text-slate-800 font-bold">{currentSelectedLoop.device_id_a || 'Chưa gán'}</span></div>
                    </div>
                  </div>

                  {/* Điểm dừng pháp lý */}
                  <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-200 text-[11px] space-y-1">
                    <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                      <span>Điểm dừng pháp lý (Vật lý)</span>
                    </div>
                    <div className="text-slate-700 pl-3.5 space-y-0.5 text-[10px]">
                      <div>Mã thiết bị: <strong className="font-mono text-indigo-950">{currentSelectedLoop.loop_device_code || currentSelectedLoop.loop_device_id || 'Chưa chọn'}</strong></div>
                      <div>Vị trí trụ: <span className="font-mono font-bold text-slate-900">{currentSelectedLoop.loop_device_pole || 'Chưa cập nhật'}</span></div>
                      <div>Đội QLVH: <span>{currentSelectedLoop.loop_device_team || currentSelectedLoop.loop_device_unit || 'Đội Vận Hành'}</span></div>
                    </div>
                  </div>

                  {/* Phía B */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Phía B (Nguồn B)</span>
                    </div>
                    <div className="text-slate-600 pl-3.5 space-y-0.5 text-[10px]">
                      <div>Trạm: <strong>{currentSelectedLoop.substation_name_b || 'Chưa gán'}</strong> ({currentSelectedLoop.substation_code_b || '-'})</div>
                      <div>Phát tuyến: <strong>{currentSelectedLoop.feeder_code_b || 'Chưa gán'}</strong></div>
                      <div>Thiết bị đầu B: <span className="font-mono text-slate-800 font-bold">{currentSelectedLoop.device_id_b || 'Chưa gán'}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Location Coordinates & Map Link */}
              {currentSelectedLoop && (currentSelectedLoop.latitude || currentSelectedLoop.google_maps_url) && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <MapPin size={12} className="text-rose-500" /> Tọa độ vị trí & GIS
                  </span>
                  {currentSelectedLoop.latitude && currentSelectedLoop.longitude && (
                    <div className="font-mono text-[10px] text-slate-700">
                      GPS: {Number(currentSelectedLoop.latitude).toFixed(5)}, {Number(currentSelectedLoop.longitude).toFixed(5)}
                    </div>
                  )}
                  {currentSelectedLoop.google_maps_url && (
                    <a
                      href={currentSelectedLoop.google_maps_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-600 hover:text-sky-800 inline-flex items-center gap-1 text-[10px] font-semibold pt-0.5"
                    >
                      <span>Xem vị trí trên Google Maps</span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ======================= CREATE / EDIT LOOP MODAL ======================= */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw size={18} className="text-indigo-400 animate-spin-slow" />
                <h3 className="font-bold text-sm">
                  {isEditModalOpen ? `Chỉnh Sửa Khép Vòng (${formData.loop_id})` : 'Tạo Mạch Khép Vòng Lưới Điện Mới'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-white bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveLoopSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* General Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã Khép Vòng *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: KV-110-01"
                    value={formData.loop_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, loop_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tên Mạch Khép Vòng *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Khép vòng 471 E1.1 - 472 E1.2"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              </div>

              {/* SIDE A SELECTION */}
              <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2.5">
                <div className="font-bold text-blue-900 uppercase text-[11px] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Cấu hình Phía A (Nguồn A) *</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Trạm 110kV A *</label>
                    <select
                      required
                      value={formData.substation_id_a}
                      onChange={(e) => handleModalStationAChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="">-- Chọn Trạm A --</option>
                      {substations.map(st => (
                        <option key={st.id} value={String(st.id)}>
                          {st.name} ({st.substation_code || 'TBA'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phát tuyến A *</label>
                    <select
                      required
                      disabled={!formData.substation_id_a}
                      value={formData.feeder_id_a}
                      onChange={(e) => handleModalFeederAChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-100"
                    >
                      <option value="">-- Chọn Tuyến A --</option>
                      {modalFeedersA.map(f => (
                        <option key={f.id} value={String(f.id)}>
                          {f.feeder_code} - {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Thiết bị đầu A *</label>
                    <select
                      required
                      disabled={!formData.feeder_id_a}
                      value={formData.device_id_a}
                      onChange={(e) => setFormData(prev => ({ ...prev, device_id_a: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-100"
                    >
                      <option value="">-- Chọn Thiết bị A --</option>
                      {modalDevicesA.map(d => (
                        <option key={d.id} value={d.device_id || String(d.id)}>
                          {d.device_code || d.device_id} ({d.device_type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* MAIN LOOP DEVICE (PHYSICAL DEVICE) */}
              <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-2.5">
                <div className="font-bold text-indigo-950 uppercase text-[11px] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                    <span>Điểm Dừng Pháp Lý (Vật lý)</span>
                  </span>
                  <span className="text-[10px] text-indigo-700 font-normal">Thiết bị đóng cắt thực tế</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Chọn Điểm Dừng Pháp Lý:</label>
                    <select
                      value={formData.loop_device_id}
                      onChange={(e) => handleModalLoopDeviceSelect(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                    >
                      <option value="">-- Chọn Điểm Dừng Pháp Lý --</option>
                      {devices.map(d => (
                        <option key={d.id} value={d.device_id || String(d.id)}>
                          {d.device_code || d.device_id} - {d.name} ({d.device_type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Trạng thái vận hành điểm khép:</label>
                    <select
                      value={formData.operation_status}
                      onChange={(e) => setFormData(prev => ({ ...prev, operation_status: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold"
                    >
                      <option value="OPEN">🟡 MỞ (Đang Mở Vòng)</option>
                      <option value="CLOSED">🟢 ĐÓNG (Đang Khép Vòng)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SIDE B SELECTION */}
              <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2.5">
                <div className="font-bold text-amber-900 uppercase text-[11px] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Cấu hình Phía B (Nguồn B) *</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Trạm 110kV B *</label>
                    <select
                      required
                      value={formData.substation_id_b}
                      onChange={(e) => handleModalStationBChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-medium"
                    >
                      <option value="">-- Chọn Trạm B --</option>
                      {substations.map(st => (
                        <option key={st.id} value={String(st.id)}>
                          {st.name} ({st.substation_code || 'TBA'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phát tuyến B *</label>
                    <select
                      required
                      disabled={!formData.substation_id_b}
                      value={formData.feeder_id_b}
                      onChange={(e) => handleModalFeederBChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-medium disabled:bg-slate-100"
                    >
                      <option value="">-- Chọn Tuyến B --</option>
                      {modalFeedersB.map(f => (
                        <option key={f.id} value={String(f.id)}>
                          {f.feeder_code} - {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Thiết bị đầu B *</label>
                    <select
                      required
                      disabled={!formData.feeder_id_b}
                      value={formData.device_id_b}
                      onChange={(e) => setFormData(prev => ({ ...prev, device_id_b: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-medium disabled:bg-slate-100"
                    >
                      <option value="">-- Chọn Thiết bị B --</option>
                      {modalDevicesB.map(d => (
                        <option key={d.id} value={d.device_id || String(d.id)}>
                          {d.device_code || d.device_id} ({d.device_type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Status, Inspection cycle & GPS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Trạng thái cấu hình</label>
                  <select
                    value={formData.configuration_status}
                    onChange={(e) => setFormData(prev => ({ ...prev, configuration_status: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="ACTIVE">ACTIVE (Đang sử dụng)</option>
                    <option value="INACTIVE">INACTIVE (Tạm ngưng)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Chu kỳ kiểm tra</label>
                  <select
                    value={formData.inspection_cycle}
                    onChange={(e) => setFormData(prev => ({ ...prev, inspection_cycle: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="MONTHLY">Hàng tháng</option>
                    <option value="QUARTERLY">Hàng quý</option>
                    <option value="YEARLY">Hàng năm</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Link Google Maps</label>
                  <input
                    type="text"
                    placeholder="https://maps.google.com/..."
                    value={formData.google_maps_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, google_maps_url: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-[11px]"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Ghi chú phương thức vận hành</label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú chi tiết về phương thức cấp điện..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white text-xs"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isSaving && <Loader2 size={14} className="animate-spin" />}
                  <span>{isEditModalOpen ? 'Cập Nhật Khép Vòng' : 'Tạo Khép Vòng'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= DELETE CONFIRMATION MODAL ======================= */}
      {isDeleteModalOpen && activeLoopForAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-2xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Xác nhận xóa Khép Vòng</h3>
                <p className="text-xs text-slate-500">Thao tác này sẽ xóa vĩnh viễn cấu hình khép vòng trong CSDL.</p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {deleteError}
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div>Mã khép vòng: <strong className="font-mono text-slate-900">{activeLoopForAction.loop_id}</strong></div>
              <div>Tên khép vòng: <strong className="text-slate-900">{activeLoopForAction.name}</strong></div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isDeleting && <Loader2 size={14} className="animate-spin" />}
                <span>Xác nhận Xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= REACTFLOW CANVAS ======================= */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => setSelectedNode(node)}
        onMove={(_, vp) => setViewportState(vp)}
        fitView
        fitViewOptions={{ padding: 0.15, duration: 500 }}
        minZoom={0.05}
        maxZoom={2.5}
        panOnDrag={true}
        panOnScroll={false}
        zoomOnPinch={true}
        zoomOnDoubleClick={true}
        zoomOnScroll={true}
        nodesDraggable={!isPanMode}
        nodesConnectable={false}
        elevateNodesOnSelect={true}
      >
        <Controls showFitView={false} showZoom={false} showInteractive={false} className="!hidden" />
        <Background color="#cbd5e1" gap={20} size={1} />
      </ReactFlow>

      {/* ======================= FLOATING PAN & ZOOM SLIDERS PANEL ======================= */}
      <div className="absolute bottom-4 left-4 z-30 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-slate-200/90 pointer-events-auto w-72 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <SlidersHorizontal size={14} className="text-indigo-600" />
            <span>Thanh kéo trượt sơ đồ</span>
          </div>
          <button
            onClick={() => setShowSlidersPanel(!showSlidersPanel)}
            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            {showSlidersPanel ? 'Thu gọn' : 'Mở rộng'}
          </button>
        </div>

        {showSlidersPanel && (
          <div className="space-y-2.5 text-xs">
            {/* Mobile Pan Mode Toggle */}
            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
              <span className="text-[11px] font-medium text-slate-700">Chế độ trượt/di chuyển sơ đồ</span>
              <button
                onClick={() => setIsPanMode(!isPanMode)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  isPanMode 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                }`}
              >
                {isPanMode ? 'Đang bật (Pan)' : 'Tắt'}
              </button>
            </div>
            {/* Horizontal Pan */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Trượt ngang (X)</span>
                <span className="font-mono">{Math.round(viewportState.x)}px</span>
              </div>
              <input
                type="range"
                min={-3000}
                max={3000}
                step={10}
                value={viewportState.x}
                onChange={(e) => {
                  const x = Number(e.target.value);
                  setViewport({ ...viewportState, x }, { duration: 50 });
                }}
                className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
            </div>

            {/* Vertical Pan */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Trượt dọc (Y)</span>
                <span className="font-mono">{Math.round(viewportState.y)}px</span>
              </div>
              <input
                type="range"
                min={-3000}
                max={3000}
                step={10}
                value={viewportState.y}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setViewport({ ...viewportState, y }, { duration: 50 });
                }}
                className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
            </div>

            {/* Zoom Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Thu phóng (Zoom)</span>
                <span className="font-mono">{Math.round(viewportState.zoom * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={2.5}
                step={0.05}
                value={viewportState.zoom}
                onChange={(e) => {
                  const zoom = Number(e.target.value);
                  setViewport({ ...viewportState, zoom }, { duration: 50 });
                }}
                className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 });
                }}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-[11px] transition-all cursor-pointer"
              >
                Đặt lại gốc (0,0)
              </button>
              <button
                onClick={handleFitToView}
                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-[11px] transition-all cursor-pointer"
              >
                Vừa khung nhìn
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TOPOLOGY DIAGNOSTICS & VALIDATION REPORT MODAL */}
      <TopologyDiagnosticsModal
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setIsDiagnosticsModalOpen(false)}
        report={diagnosticsReport}
        loopName={activeLoopForAction?.name}
        loopCode={activeLoopForAction?.loop_id}
        onEditLoop={activeLoopForAction ? () => {
          setIsDiagnosticsModalOpen(false);
          handleOpenEditModal(activeLoopForAction);
        } : undefined}
      />
    </div>
  );
}

export function DynamicGraphPage() {
  return (
    <ReactFlowProvider>
      <DynamicGraphInner />
    </ReactFlowProvider>
  );
}
