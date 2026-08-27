import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Plus,
  Trash2,
  RotateCcw,
  RotateCw,
  LayoutGrid,
  Link as LinkIcon,
  Replace,
  Split,
  Activity,
  AlertCircle,
  Building2,
  GitCommitHorizontal,
  Search,
  X,
  MapPin,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Edit2,
  ArrowRight,
  Zap
} from 'lucide-react';
import { Device, TopologyNode, TopologyEdge, Loop, SwitchStatus, Substation, Feeder } from '../../types';
import { api } from '../../lib/api';
import { validateTopology, TopologyValidationReport } from '../../lib/topologyValidator';
import { TopologyDiagnosticsModal } from './TopologyDiagnosticsModal';

interface TopologyCanvasProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  onChange: (nodes: TopologyNode[], edges: TopologyEdge[]) => void;
  readOnly?: boolean;
  loop?: Loop | null;
  onEditLoop?: (loopId: string | number) => void;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  nodes,
  edges,
  onChange,
  readOnly = false,
  loop = null,
  onEditLoop
}) => {
  // Canvas viewport state
  const [zoom, setZoom] = useState<number>(0.9);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Selection state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null);

  // Dragging node state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Connection creation mode
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);

  // History stack for Undo / Redo
  const [history, setHistory] = useState<{ nodes: TopologyNode[]; edges: TopologyEdge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Master data for validation
  const [systemDevices, setSystemDevices] = useState<Device[]>([]);
  const [allDbSubstations, setAllDbSubstations] = useState<Substation[]>([]);
  const [allDbFeeders, setAllDbFeeders] = useState<Feeder[]>([]);
  const [allDbLoops, setAllDbLoops] = useState<Loop[]>([]);

  // Topology Diagnostics & Validation state
  const [validationReport, setValidationReport] = useState<TopologyValidationReport | null>(null);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);
  const [isCheckingValidation, setIsCheckingValidation] = useState(false);

  // Modals
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [isAddBetweenOpen, setIsAddBetweenOpen] = useState(false);
  const [isReplaceDeviceOpen, setIsReplaceDeviceOpen] = useState(false);
  const [deviceSearchTerm, setDeviceSearchTerm] = useState('');
  const [replaceConfirmModal, setReplaceConfirmModal] = useState<{
    oldDevice: Device | null;
    newDevice: Device | null;
    affectedEdgesCount: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load all reference data from DB for accurate relational & topological check
  const fetchAllReferenceData = useCallback(async () => {
    try {
      const [devRes, subRes, feedRes, loopRes] = await Promise.all([
        api.getDevices({ limit: 500 }),
        api.getSubstations(),
        api.getFeeders(),
        api.getLoops()
      ]);
      if (devRes.success) setSystemDevices(devRes.data);
      if (subRes.success) setAllDbSubstations(subRes.data);
      if (feedRes.success) setAllDbFeeders(feedRes.data);
      if (loopRes.success) setAllDbLoops(loopRes.data);
    } catch (e) {
      console.error('Error fetching reference data for topology validator:', e);
    }
  }, []);

  useEffect(() => {
    fetchAllReferenceData();
  }, [fetchAllReferenceData]);

  // Run Topology Validation Check (Read-only, no data changes)
  const runValidationCheck = useCallback(() => {
    setIsCheckingValidation(true);
    try {
      const report = validateTopology({
        loop,
        nodes,
        edges,
        allDevices: systemDevices,
        allFeeders: allDbFeeders,
        allSubstations: allDbSubstations,
        allLoops: allDbLoops
      });
      setValidationReport(report);
    } catch (err) {
      console.error('Error validating topology:', err);
    } finally {
      setIsCheckingValidation(false);
    }
  }, [loop, nodes, edges, systemDevices, allDbFeeders, allDbSubstations, allDbLoops]);

  // Auto-validate whenever loop, nodes or edges change
  useEffect(() => {
    runValidationCheck();
  }, [runValidationCheck]);

  // Focus node on canvas helper
  const handleFocusNode = (nodeId: string) => {
    const node = nodes.find(n => n.device_id === nodeId);
    if (!node || !containerRef.current) return;

    setSelectedNodeId(nodeId);
    const rect = containerRef.current.getBoundingClientRect();
    const targetPanX = rect.width / 2 - (node.pos_x + 100) * zoom;
    const targetPanY = rect.height / 2 - (node.pos_y + 50) * zoom;
    setPan({ x: targetPanX, y: targetPanY });
  };

  // Push history helper
  const updateTopologyState = useCallback(
    (newNodes: TopologyNode[], newEdges: TopologyEdge[], saveToHistory = true) => {
      onChange(newNodes, newEdges);
      if (saveToHistory) {
        const nextHistory = history.slice(0, historyIndex + 1);
        nextHistory.push({ nodes: newNodes, edges: newEdges });
        setHistory(nextHistory);
        setHistoryIndex(nextHistory.length - 1);
      }
    },
    [onChange, history, historyIndex]
  );

  // Auto initialize standard 7-node chain if nodes are empty and loop is provided
  const buildStandard7NodeTopology = useCallback((currentLoop: Loop) => {
    const startY = 220;
    const standardNodes: TopologyNode[] = [];
    const standardEdges: TopologyEdge[] = [];

    // Helper to build device placeholder
    const makeDevice = (
      id: number,
      deviceId: string,
      name: string,
      code: string,
      type: string,
      swStatus: SwitchStatus,
      extra?: Partial<Device>
    ): Device => ({
      id,
      device_id: deviceId,
      device_code: code,
      name,
      device_type: type as any,
      unit: extra?.unit || 'EVN',
      team: extra?.team || 'Đội QLVH',
      status: 'ACTIVE',
      switch_status: swStatus,
      scada_status: 'SIGNAL',
      relay_79: 'ON',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...extra
    });

    // 1. Station A (Trạm 110kV A)
    const stAId = `STA_${currentLoop.substation_id_a || 'A'}`;
    standardNodes.push({
      device_id: stAId,
      pos_x: 60,
      pos_y: startY,
      device: makeDevice(
        currentLoop.substation_id_a || 1,
        stAId,
        currentLoop.substation_name_a || 'Trạm 110kV A',
        currentLoop.substation_code_a || 'TBA-110kV-A',
        'SUBSTATION',
        'CLOSED',
        { substation_code: currentLoop.substation_code_a || 'TBA-A' }
      )
    });

    // 2. Feeder A (Phát tuyến A)
    const fAId = `FDA_${currentLoop.feeder_id_a || 'A'}`;
    standardNodes.push({
      device_id: fAId,
      pos_x: 350,
      pos_y: startY,
      device: makeDevice(
        currentLoop.feeder_id_a || 1,
        fAId,
        currentLoop.feeder_name_a || `Phát tuyến ${currentLoop.feeder_code_a || 'A'}`,
        currentLoop.feeder_code_a || 'PT-22kV-A',
        'FEEDER',
        'CLOSED',
        {
          feeder_code: currentLoop.feeder_code_a || 'PT-A',
          substation_code: currentLoop.substation_code_a || 'TBA-A'
        }
      )
    });

    // 3. Device A (Thiết bị đầu A)
    const devAId = String(currentLoop.device_id_a || 'DEV_A');
    const swA: SwitchStatus = (currentLoop.switch_status_a as SwitchStatus) || 'CLOSED';
    standardNodes.push({
      device_id: devAId,
      pos_x: 640,
      pos_y: startY,
      device: makeDevice(
        101,
        devAId,
        currentLoop.device_name_a || `Thiết bị A (${devAId})`,
        currentLoop.device_code_a || devAId,
        currentLoop.device_type_a || 'LBS',
        swA,
        {
          feeder_code: currentLoop.feeder_code_a || 'PT-A',
          substation_code: currentLoop.substation_code_a || 'TBA-A'
        }
      )
    });

    // 4. Main Loop Device (Thiết bị Khép vòng chính - Trung tâm)
    const loopDevId = String(currentLoop.loop_device_id || currentLoop.loop_device_code || 'DEV_LOOP_MAIN');
    const isLoopClosed = (currentLoop.operation_status || currentLoop.status) === 'CLOSED';
    standardNodes.push({
      device_id: loopDevId,
      pos_x: 960,
      pos_y: startY - 25,
      device: makeDevice(
        100,
        loopDevId,
        currentLoop.loop_device_name || `TB Khép Vòng (${loopDevId})`,
        currentLoop.loop_device_code || loopDevId,
        currentLoop.loop_device_type || 'LBS',
        isLoopClosed ? 'CLOSED' : 'OPEN',
        {
          pole_number: currentLoop.loop_device_pole,
          team: currentLoop.loop_device_team || currentLoop.loop_device_unit || 'Đội QLVH',
          unit: currentLoop.loop_device_unit || 'EVN',
          latitude: currentLoop.latitude || currentLoop.loop_device_latitude,
          longitude: currentLoop.longitude || currentLoop.loop_device_longitude,
          google_maps_url: currentLoop.google_maps_url || currentLoop.loop_device_maps_url
        }
      )
    });

    // 5. Device B (Thiết bị đầu B)
    const devBId = String(currentLoop.device_id_b || 'DEV_B');
    const swB: SwitchStatus = (currentLoop.switch_status_b as SwitchStatus) || 'CLOSED';
    standardNodes.push({
      device_id: devBId,
      pos_x: 1320,
      pos_y: startY,
      device: makeDevice(
        102,
        devBId,
        currentLoop.device_name_b || `Thiết bị B (${devBId})`,
        currentLoop.device_code_b || devBId,
        currentLoop.device_type_b || 'LBS',
        swB,
        {
          feeder_code: currentLoop.feeder_code_b || 'PT-B',
          substation_code: currentLoop.substation_code_b || 'TBA-B'
        }
      )
    });

    // 6. Feeder B (Phát tuyến B)
    const fBId = `FDB_${currentLoop.feeder_id_b || 'B'}`;
    standardNodes.push({
      device_id: fBId,
      pos_x: 1610,
      pos_y: startY,
      device: makeDevice(
        currentLoop.feeder_id_b || 2,
        fBId,
        currentLoop.feeder_name_b || `Phát tuyến ${currentLoop.feeder_code_b || 'B'}`,
        currentLoop.feeder_code_b || 'PT-22kV-B',
        'FEEDER',
        'CLOSED',
        {
          feeder_code: currentLoop.feeder_code_b || 'PT-B',
          substation_code: currentLoop.substation_code_b || 'TBA-B'
        }
      )
    });

    // 7. Station B (Trạm 110kV B)
    const stBId = `STB_${currentLoop.substation_id_b || 'B'}`;
    standardNodes.push({
      device_id: stBId,
      pos_x: 1900,
      pos_y: startY,
      device: makeDevice(
        currentLoop.substation_id_b || 2,
        stBId,
        currentLoop.substation_name_b || 'Trạm 110kV B',
        currentLoop.substation_code_b || 'TBA-110kV-B',
        'SUBSTATION',
        'CLOSED',
        { substation_code: currentLoop.substation_code_b || 'TBA-B' }
      )
    });

    // Standard Edges: StA -> FeederA -> DevA -> LoopDev -> DevB -> FeederB -> StB
    standardEdges.push({
      source_device_id: stAId,
      target_device_id: fAId,
      connection_type: 'OVERHEAD',
      status: 'ACTIVE'
    });
    standardEdges.push({
      source_device_id: fAId,
      target_device_id: devAId,
      connection_type: 'OVERHEAD',
      status: 'ACTIVE'
    });
    standardEdges.push({
      source_device_id: devAId,
      target_device_id: loopDevId,
      connection_type: 'OVERHEAD',
      status: 'ACTIVE'
    });
    standardEdges.push({
      source_device_id: loopDevId,
      target_device_id: devBId,
      connection_type: 'OVERHEAD',
      status: 'ACTIVE'
    });
    standardEdges.push({
      source_device_id: devBId,
      target_device_id: fBId,
      connection_type: 'OVERHEAD',
      status: 'ACTIVE'
    });
    standardEdges.push({
      source_device_id: fBId,
      target_device_id: stBId,
      connection_type: 'OVERHEAD',
      status: 'ACTIVE'
    });

    return { standardNodes, standardEdges };
  }, []);

  // Initial history push or setup standard nodes if empty
  useEffect(() => {
    if (nodes.length === 0 && loop) {
      const { standardNodes, standardEdges } = buildStandard7NodeTopology(loop);
      updateTopologyState(standardNodes, standardEdges, true);
    } else if (history.length === 0 && (nodes.length > 0 || edges.length > 0)) {
      setHistory([{ nodes, edges }]);
      setHistoryIndex(0);
    }
  }, [loop, nodes.length, edges.length, history.length, buildStandard7NodeTopology, updateTopologyState]);

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onChange(prev.nodes, prev.edges);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      onChange(next.nodes, next.edges);
    }
  };

  // Zoom handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.15, 2.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.4));
  const handleResetZoom = () => {
    setZoom(0.85);
    setPan({ x: 30, y: 50 });
  };

  // Action: Apply Strict 7-Node Standard Chain
  const handleApplyStandard7NodeChain = () => {
    if (!loop) {
      alert('Không có thông tin cấu hình Khép vòng để thiết lập cấu trúc 7 nút.');
      return;
    }
    const { standardNodes, standardEdges } = buildStandard7NodeTopology(loop);
    updateTopologyState(standardNodes, standardEdges, true);
    setPan({ x: 30, y: 50 });
    setZoom(0.85);
  };

  // Auto Layout for arbitrary node collection
  const handleAutoLayout = () => {
    if (nodes.length === 0) return;
    if (loop && nodes.length >= 7) {
      handleApplyStandard7NodeChain();
      return;
    }
    const startX = 120;
    const startY = 220;
    const gapX = 280;

    const newNodes = nodes.map((node, index) => ({
      ...node,
      pos_x: startX + index * gapX,
      pos_y: startY + (index % 2 === 1 ? 40 : 0)
    }));

    updateTopologyState(newNodes, edges);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(prev + 0.08, 2.5));
    } else {
      setZoom(prev => Math.max(prev - 0.08, 0.4));
    }
  };

  // Pan canvas
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      startPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      setSelectedNodeId(null);
      setSelectedEdgeIndex(null);
    }
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPanRef.current.x,
        y: e.clientY - startPanRef.current.y
      });
    } else if (draggingNodeId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseY = (e.clientY - rect.top - pan.y) / zoom;

      const newNodes = nodes.map(n => {
        if (n.device_id === draggingNodeId) {
          return {
            ...n,
            pos_x: Math.max(20, Math.round(mouseX - dragOffsetRef.current.x)),
            pos_y: Math.max(20, Math.round(mouseY - dragOffsetRef.current.y))
          };
        }
        return n;
      });
      onChange(newNodes, edges);
    }
  };

  const handleMouseUpCanvas = () => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (draggingNodeId) {
      setDraggingNodeId(null);
      updateTopologyState(nodes, edges);
    }
  };

  // Node Drag start
  const handleNodeMouseDown = (e: React.MouseEvent, deviceId: string) => {
    e.stopPropagation();
    if (readOnly) return;

    if (connectSourceId) {
      if (connectSourceId !== deviceId) {
        handleCreateEdge(connectSourceId, deviceId);
      }
      setConnectSourceId(null);
      return;
    }

    setSelectedNodeId(deviceId);
    setSelectedEdgeIndex(null);
    setDraggingNodeId(deviceId);

    const node = nodes.find(n => n.device_id === deviceId);
    if (node && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseY = (e.clientY - rect.top - pan.y) / zoom;
      dragOffsetRef.current = {
        x: mouseX - node.pos_x,
        y: mouseY - node.pos_y
      };
    }
  };

  // Create Connection Edge
  const handleCreateEdge = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    const exists = edges.some(
      e =>
        (e.source_device_id === sourceId && e.target_device_id === targetId) ||
        (e.source_device_id === targetId && e.target_device_id === sourceId)
    );

    if (exists) {
      alert('Kết nối giữa hai phần tử này đã tồn tại!');
      return;
    }

    const newEdge: TopologyEdge = {
      source_device_id: sourceId,
      target_device_id: targetId,
      connection_type: 'OVERHEAD',
      status: 'ACTIVE'
    };

    updateTopologyState(nodes, [...edges, newEdge]);
  };

  // Delete selected node
  const handleDeleteSelectedNode = () => {
    if (!selectedNodeId) return;

    const nodeToDelete = nodes.find(n => n.device_id === selectedNodeId);
    const deviceName = nodeToDelete?.device?.name || selectedNodeId;

    if (
      confirm(
        `XÁC NHẬN XÓA KHỎI SƠ ĐỒ:\nBạn có chắc chắn muốn xóa phần tử '${deviceName}' (${selectedNodeId}) khỏi sơ đồ không?\n\nLưu ý: Hành động này CHỈ xóa phần tử khỏi sơ đồ Topology. Hồ sơ trong Database VẪN TỒN TẠI!`
      )
    ) {
      const newNodes = nodes.filter(n => n.device_id !== selectedNodeId);
      const newEdges = edges.filter(
        e => e.source_device_id !== selectedNodeId && e.target_device_id !== selectedNodeId
      );

      setSelectedNodeId(null);
      updateTopologyState(newNodes, newEdges);
    }
  };

  // Delete selected connection edge
  const handleDeleteSelectedEdge = () => {
    if (selectedEdgeIndex === null) return;

    const newEdges = edges.filter((_, idx) => idx !== selectedEdgeIndex);
    setSelectedEdgeIndex(null);
    updateTopologyState(nodes, newEdges);
  };

  // Load system devices
  const fetchSystemDevices = async () => {
    try {
      const res = await api.getDevices({ limit: 100 });
      if (res.success) {
        setSystemDevices(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenAddDeviceModal = () => {
    fetchSystemDevices();
    setIsAddDeviceOpen(true);
  };

  const handleSelectDeviceToAdd = (device: Device) => {
    if (nodes.some(n => n.device_id === device.device_id)) {
      alert(`Thiết bị ${device.device_id} đã có trên sơ đồ!`);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    const centerX = rect ? (rect.width / 2 - pan.x) / zoom : 400;
    const centerY = rect ? (rect.height / 2 - pan.y) / zoom : 250;

    const newNode: TopologyNode = {
      device_id: device.device_id,
      pos_x: Math.round(centerX),
      pos_y: Math.round(centerY),
      device
    };

    setIsAddDeviceOpen(false);
    updateTopologyState([...nodes, newNode], edges);
  };

  // Add intermediate device
  const handleOpenAddBetweenModal = () => {
    fetchSystemDevices();
    setIsAddBetweenOpen(true);
  };

  const handleAddIntermediateDevice = (newDevice: Device) => {
    if (nodes.some(n => n.device_id === newDevice.device_id)) {
      alert(`Thiết bị ${newDevice.device_id} đã tồn tại trên sơ đồ!`);
      return;
    }

    let sourceNode: TopologyNode | undefined;
    let targetNode: TopologyNode | undefined;

    if (selectedEdgeIndex !== null && edges[selectedEdgeIndex]) {
      const edge = edges[selectedEdgeIndex];
      sourceNode = nodes.find(n => n.device_id === edge.source_device_id);
      targetNode = nodes.find(n => n.device_id === edge.target_device_id);
    } else if (nodes.length >= 2) {
      sourceNode = nodes[0];
      targetNode = nodes[1];
    }

    if (!sourceNode || !targetNode) {
      alert('Vui lòng chọn một đường dây kết nối hoặc ít nhất 2 nút trên sơ đồ!');
      return;
    }

    const newPosX = Math.round((sourceNode.pos_x + targetNode.pos_x) / 2);
    const newPosY = Math.round((sourceNode.pos_y + targetNode.pos_y) / 2);

    const intermediateNode: TopologyNode = {
      device_id: newDevice.device_id,
      pos_x: newPosX,
      pos_y: newPosY,
      device: newDevice
    };

    const remainingEdges = edges.filter(
      e =>
        !(
          (e.source_device_id === sourceNode!.device_id && e.target_device_id === targetNode!.device_id) ||
          (e.source_device_id === targetNode!.device_id && e.target_device_id === sourceNode!.device_id)
        )
    );

    const newEdge1: TopologyEdge = {
      source_device_id: sourceNode.device_id,
      target_device_id: newDevice.device_id,
      connection_type: 'OVERHEAD',
      status: 'ACTIVE'
    };

    const newEdge2: TopologyEdge = {
      source_device_id: newDevice.device_id,
      target_device_id: targetNode.device_id,
      connection_type: 'OVERHEAD',
      status: 'ACTIVE'
    };

    setIsAddBetweenOpen(false);
    updateTopologyState([...nodes, intermediateNode], [...remainingEdges, newEdge1, newEdge2]);
  };

  // Replace Device
  const handleOpenReplaceModal = () => {
    if (!selectedNodeId) return;
    fetchSystemDevices();
    setIsReplaceDeviceOpen(true);
  };

  const handleInitiateReplace = (newDevice: Device) => {
    if (newDevice.device_id === selectedNodeId) {
      alert('Thiết bị mới trùng với thiết bị hiện tại!');
      return;
    }

    const oldNode = nodes.find(n => n.device_id === selectedNodeId);
    const affectedEdges = edges.filter(
      e => e.source_device_id === selectedNodeId || e.target_device_id === selectedNodeId
    );

    setReplaceConfirmModal({
      oldDevice: oldNode?.device || null,
      newDevice,
      affectedEdgesCount: affectedEdges.length
    });

    setIsReplaceDeviceOpen(false);
  };

  const handleConfirmReplaceDevice = () => {
    if (!replaceConfirmModal || !replaceConfirmModal.newDevice || !selectedNodeId) return;

    const oldDeviceId = selectedNodeId;
    const newDeviceId = replaceConfirmModal.newDevice.device_id;
    const newDevice = replaceConfirmModal.newDevice;

    const updatedNodes = nodes.map(n => {
      if (n.device_id === oldDeviceId) {
        return {
          ...n,
          device_id: newDeviceId,
          device: newDevice
        };
      }
      return n;
    });

    const updatedEdges = edges.map(e => ({
      ...e,
      source_device_id: e.source_device_id === oldDeviceId ? newDeviceId : e.source_device_id,
      target_device_id: e.target_device_id === oldDeviceId ? newDeviceId : e.target_device_id
    }));

    setSelectedNodeId(newDeviceId);
    setReplaceConfirmModal(null);
    updateTopologyState(updatedNodes, updatedEdges);
  };

  // Filtered devices for search modal
  const filteredSystemDevices = systemDevices.filter(d => {
    const term = deviceSearchTerm.toLowerCase();
    return (
      String(d.device_id || '').toLowerCase().includes(term) ||
      String(d.name || '').toLowerCase().includes(term) ||
      (d.pole_number && String(d.pole_number).toLowerCase().includes(term)) ||
      (d.feeder_code && String(d.feeder_code).toLowerCase().includes(term)) ||
      (d.substation_code && String(d.substation_code).toLowerCase().includes(term)) ||
      String(d.device_type || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="relative w-full h-[680px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col select-none">
      {/* Top Header Mandatory Chain Banner */}
      <div className="z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <span className="flex items-center text-blue-400 font-bold gap-1 bg-blue-950/80 px-2.5 py-1 rounded-lg border border-blue-800/60">
            <Activity className="w-4 h-4 animate-pulse text-blue-400" /> Sơ đồ GRAPH Khép Vòng Chuẩn (7 Nút)
          </span>

          <div className="hidden lg:flex items-center space-x-1 text-[11px] text-slate-300 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 font-mono">
            <span className="text-amber-400 font-bold">Trạm 110kV A</span>
            <span className="text-slate-500">→</span>
            <span className="text-sky-400 font-bold">Phát tuyến A</span>
            <span className="text-slate-500">→</span>
            <span className="text-emerald-400 font-bold">TB A</span>
            <span className="text-slate-500">→</span>
            <span className="text-purple-300 font-black bg-purple-950/80 px-1 rounded border border-purple-800">TB Khép Vòng</span>
            <span className="text-slate-500">→</span>
            <span className="text-emerald-400 font-bold">TB B</span>
            <span className="text-slate-500">→</span>
            <span className="text-sky-400 font-bold">Phát tuyến B</span>
            <span className="text-slate-500">→</span>
            <span className="text-amber-400 font-bold">Trạm 110kV B</span>
          </div>

          {connectSourceId && (
            <span className="flex items-center text-amber-300 bg-amber-950/90 px-2.5 py-1 rounded-lg border border-amber-700 animate-bounce">
              <LinkIcon className="w-3.5 h-3.5 mr-1" /> Click chọn nút đích để tạo kết nối...
            </span>
          )}

          {selectedNodeId && (
            <span className="text-slate-300 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700">
              Đang chọn: <strong className="text-white">{selectedNodeId}</strong>
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-1.5">
          {/* Topology Diagnostic Badge / Trigger */}
          {validationReport && (
            <button
              onClick={() => setIsDiagnosticsModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md ${
                validationReport.isValid
                  ? 'bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-600 text-emerald-300'
                  : 'bg-rose-950/90 hover:bg-rose-900 border border-rose-600 text-rose-300 animate-pulse'
              }`}
              title="Nhấp để xem bảng kiểm tra lỗi và cảnh báo Topology chi tiết"
            >
              {validationReport.isValid ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>🟢 Topology hợp lệ</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>🔴 Topology có lỗi ({validationReport.errorCount})</span>
                  <span className="underline ml-1 font-extrabold">[Xem lỗi]</span>
                </>
              )}
            </button>
          )}

          {/* Manual Run Topology Check Button */}
          <button
            onClick={runValidationCheck}
            disabled={isCheckingValidation}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-xs border border-slate-700 transition"
            title="Chạy kiểm tra lại toàn bộ cấu trúc Topology Khép vòng"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingValidation ? 'animate-spin' : ''}`} />
            <span>Kiểm tra Topology</span>
          </button>

          {/* Edit Loop Button if loop available */}
          {loop && onEditLoop && (
            <button
              onClick={() => onEditLoop(loop.id || loop.loop_id)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white font-bold rounded-lg text-xs transition"
              title="Mở bảng chỉnh sửa thông tin Khép vòng"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Chỉnh sửa Khép vòng</span>
            </button>
          )}

          <div className="h-4 w-[1px] bg-slate-800 mx-0.5" />

          {/* Quick Standard 7-Node Layout Reset */}
          {loop && !readOnly && (
            <button
              onClick={handleApplyStandard7NodeChain}
              className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-lg shadow-md transition-all text-xs"
              title="Căn chỉnh và hiển thị đúng chuẩn 7 nút: Trạm A → Tuyến A → TB A → TB Khép vòng → TB B → Tuyến B → Trạm B"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> [ ⚡ KHÉP VÒNG CHUẨN 7 NÚT ]
            </button>
          )}

          {!readOnly && (
            <>
              {/* Add Device */}
              <button
                onClick={handleOpenAddDeviceModal}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-sm transition-all"
                title="Chọn thiết bị từ Database đưa vào sơ đồ"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm Thiết Bị
              </button>

              {/* Add Intermediate Device Between */}
              <button
                onClick={handleOpenAddBetweenModal}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-sm transition-all"
                title="Chèn thiết bị trung gian vào giữa 2 phần tử"
              >
                <Split className="w-3.5 h-3.5" /> Thêm Giữa
              </button>

              {/* Replace Device */}
              <button
                onClick={handleOpenReplaceModal}
                disabled={!selectedNodeId}
                className={`flex items-center gap-1 px-2.5 py-1.5 font-bold rounded-lg shadow-sm transition-all ${
                  selectedNodeId
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
                title="Thay thế thiết bị đang chọn mà vẫn giữ nguyên kết nối"
              >
                <Replace className="w-3.5 h-3.5" /> Thay Thế
              </button>

              {/* Create Edge Toggle */}
              <button
                onClick={() => {
                  if (selectedNodeId) {
                    setConnectSourceId(selectedNodeId);
                  } else {
                    alert('Vui lòng chọn 1 nút nguồn trước!');
                  }
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 font-bold rounded-lg shadow-sm transition-all ${
                  connectSourceId
                    ? 'bg-emerald-500 text-slate-950 font-black'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
                title="Tạo đường dây kết nối giữa 2 nút"
              >
                <LinkIcon className="w-3.5 h-3.5" /> Tạo Kết Nối
              </button>

              {/* Delete Node / Edge */}
              {(selectedNodeId || selectedEdgeIndex !== null) && (
                <button
                  onClick={selectedNodeId ? handleDeleteSelectedNode : handleDeleteSelectedEdge}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-sm transition-all"
                  title={selectedNodeId ? 'Xóa khỏi sơ đồ (DB vẫn giữ nguyên)' : 'Xóa đường dây kết nối'}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Xóa
                </button>
              )}

              <div className="h-4 w-[1px] bg-slate-800 mx-0.5"></div>

              {/* Auto Layout */}
              <button
                onClick={handleAutoLayout}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                title="Căn chỉnh tự động (Auto Layout)"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>

              {/* Undo / Redo */}
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className={`p-1.5 rounded-lg transition-colors ${
                  historyIndex > 0 ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                }`}
                title="Undo"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className={`p-1.5 rounded-lg transition-colors ${
                  historyIndex < history.length - 1 ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                }`}
                title="Redo"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Viewport Zoom Controls */}
          <div className="flex items-center space-x-1 ml-auto bg-slate-800/80 p-1 rounded-lg border border-slate-700">
            <button
              onClick={handleZoomOut}
              className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-bold text-slate-300 px-1">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700"
              title="Phóng to"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700"
              title="Về mặc định"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 7-NODE CHAIN VISUAL SEQUENCE STRIP (HIGHLIGHTING ĐIỂM DỪNG PHÁP LÝ) */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between overflow-x-auto shadow-inner text-xs">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Chuỗi 7 Nút:</span>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded font-semibold text-[11px] flex items-center gap-1">
              <Building2 className="w-3 h-3 text-amber-400" /> Trạm {loop?.substation_name_a || loop?.substation_code_a || 'A'}
            </span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
            <span className="px-2 py-0.5 bg-sky-500/10 border border-sky-500/30 text-sky-300 rounded font-semibold text-[11px] flex items-center gap-1">
              <Zap className="w-3 h-3 text-sky-400" /> Tuyến {loop?.feeder_code_a || 'A'}
            </span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
            <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-200 rounded font-semibold text-[11px]">
              TB {loop?.device_code_a || loop?.device_id_a || 'A'}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-400 font-black animate-pulse" />
            {/* PROMINENT ĐIỂM DỪNG PHÁP LÝ HIGHLIGHT */}
            <span className="px-3 py-1 bg-gradient-to-r from-amber-500 via-purple-600 to-amber-500 text-white rounded-lg font-black text-xs shadow-[0_0_15px_rgba(245,158,11,0.5)] border border-amber-300 ring-2 ring-amber-400/50 flex items-center gap-1.5 scale-105 animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              <span>⚡ ĐIỂM DỪNG PHÁP LÝ ({loop?.loop_device_code || loop?.loop_device_name || loop?.loop_device_id || 'Tâm điểm'})</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-400 font-black animate-pulse" />
            <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-200 rounded font-semibold text-[11px]">
              TB {loop?.device_code_b || loop?.device_id_b || 'B'}
            </span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
            <span className="px-2 py-0.5 bg-sky-500/10 border border-sky-500/30 text-sky-300 rounded font-semibold text-[11px] flex items-center gap-1">
              <Zap className="w-3 h-3 text-sky-400" /> Tuyến {loop?.feeder_code_b || 'B'}
            </span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
            <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded font-semibold text-[11px] flex items-center gap-1">
              <Building2 className="w-3 h-3 text-amber-400" /> Trạm {loop?.substation_name_b || loop?.substation_code_b || 'B'}
            </span>
          </div>
        </div>
        <div className="text-[11px] text-slate-400 font-medium shrink-0 ml-4">
          Cấu trúc chuẩn EVN 7 nút khép mạch
        </div>
      </div>

      {/* Main Canvas Viewport Area */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDownCanvas}
        onMouseMove={handleMouseMoveCanvas}
        onMouseUp={handleMouseUpCanvas}
        className="relative flex-1 w-full h-full overflow-hidden cursor-grab active:cursor-grabbing bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]"
      >
        {/* Transform Group */}
        <div
          className="absolute inset-0 origin-top-left transition-transform duration-75"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
          }}
        >
          {/* SVG Layer for Edges */}
          <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none z-0">
            <defs>
              <marker
                id="arrow-amber"
                viewBox="0 0 10 10"
                refX="28"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
              </marker>

              <marker
                id="arrow-blue"
                viewBox="0 0 10 10"
                refX="28"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
              </marker>

              <marker
                id="arrow-purple"
                viewBox="0 0 10 10"
                refX="28"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#a855f7" />
              </marker>
            </defs>

            {edges.map((edge, index) => {
              const sourceNode = nodes.find(n => n.device_id === edge.source_device_id);
              const targetNode = nodes.find(n => n.device_id === edge.target_device_id);

              if (!sourceNode || !targetNode) return null;

              // Center offsets based on node sizes
              const getCenterOffsets = (node: TopologyNode) => {
                const devId = String(node.device_id || '');
                const isStation = devId.startsWith('STA_') || devId.startsWith('STB_') || node.device?.device_type === ('SUBSTATION' as any);
                const isFeeder = devId.startsWith('FDA_') || devId.startsWith('FDB_') || node.device?.device_type === ('FEEDER' as any);
                const isLoopMain = loop && (devId === String(loop.loop_device_id || '') || devId === String(loop.loop_device_code || '') || devId === 'DEV_LOOP_MAIN');

                if (isStation) return { w: 120, h: 65 };
                if (isFeeder) return { w: 110, h: 55 };
                if (isLoopMain) return { w: 140, h: 100 };
                return { w: 105, h: 65 };
              };

              const srcOffsets = getCenterOffsets(sourceNode);
              const tgtOffsets = getCenterOffsets(targetNode);

              const x1 = sourceNode.pos_x + srcOffsets.w;
              const y1 = sourceNode.pos_y + srcOffsets.h;
              const x2 = targetNode.pos_x + tgtOffsets.w;
              const y2 = targetNode.pos_y + tgtOffsets.h;

              const isSelected = selectedEdgeIndex === index;
              const isUnderground = edge.connection_type === 'UNDERGROUND';

              // Determine color theme based on edge connection
              const srcId = String(sourceNode.device_id || '');
              const tgtId = String(targetNode.device_id || '');
              const isStationLink = srcId.startsWith('ST') || tgtId.startsWith('ST');
              const isLoopMainLink = Boolean(loop && (
                srcId === String(loop.loop_device_id || '') ||
                tgtId === String(loop.loop_device_id || '') ||
                srcId === 'DEV_LOOP_MAIN' ||
                tgtId === 'DEV_LOOP_MAIN'
              ));

              const strokeColor = isSelected
                ? '#38bdf8'
                : isLoopMainLink
                ? '#a855f7'
                : isStationLink
                ? '#f59e0b'
                : '#0284c7';

              const markerId = isLoopMainLink ? 'arrow-purple' : isStationLink ? 'arrow-amber' : 'arrow-blue';

              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              return (
                <g key={`edge-${edge.source_device_id}-${edge.target_device_id}-${index}`} className="group cursor-pointer">
                  {/* Click target */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth="20"
                    className="pointer-events-auto"
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedEdgeIndex(index);
                      setSelectedNodeId(null);
                    }}
                  />

                  {/* Flow glow line */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? '5' : '3'}
                    strokeDasharray={isUnderground ? '6 4' : 'none'}
                    markerEnd={`url(#${markerId})`}
                    className="transition-all"
                  />

                  {/* Midpoint badge */}
                  <g transform={`translate(${midX}, ${midY})`} className="pointer-events-none">
                    <rect
                      x="-36"
                      y="-10"
                      width="72"
                      height="20"
                      rx="10"
                      fill="#0f172a"
                      stroke={isSelected ? '#38bdf8' : '#334155'}
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      fill={strokeColor}
                      fontSize="9"
                      fontWeight="bold"
                    >
                      {isUnderground ? 'Cáp ngầm' : 'Đường dây'}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* HTML Overlay Layer for Node Cards */}
          <div className="absolute inset-0 pointer-events-none z-10">
            {nodes.map((node, index) => {
              const isSelected = selectedNodeId === node.device_id;
              const isConnectSource = connectSourceId === node.device_id;
              const isNodeFaulty = Boolean(validationReport?.highlightedNodeIds?.includes(node.device_id));

              const dev = node.device || ({
                id: index,
                device_id: node.device_id,
                name: node.device_id,
                device_type: 'LBS',
                unit: 'EVN',
                team: 'Đội QLVH',
                status: 'ACTIVE',
                switch_status: 'UNKNOWN',
                scada_status: 'UNKNOWN',
                relay_79: 'N_A',
                created_at: '',
                updated_at: ''
              } as Device);

              // Categorize Node Types
              const devId = String(node.device_id || '');
              const isStationA = devId.startsWith('STA_') || (devId.startsWith('ST') && node.pos_x < 300);
              const isStationB = devId.startsWith('STB_') || (devId.startsWith('ST') && node.pos_x > 1500);
              const isStation = isStationA || isStationB || dev.device_type === ('SUBSTATION' as any);

              const isFeederA = devId.startsWith('FDA_') || (devId.startsWith('FD') && node.pos_x < 600);
              const isFeederB = devId.startsWith('FDB_') || (devId.startsWith('FD') && node.pos_x > 1200);
              const isFeeder = isFeederA || isFeederB || dev.device_type === ('FEEDER' as any);

              const isMainLoopDev = Boolean(loop && (
                devId === String(loop.loop_device_id || '') ||
                devId === String(loop.loop_device_code || '') ||
                devId === 'DEV_LOOP_MAIN'
              ));

              // 1. RENDER STATION CARD (Trạm 110kV A / B)
              if (isStation) {
                const sideName = isStationA ? 'TRẠM 110kV NGUỒN A' : 'TRẠM 110kV NGUỒN B';
                const stName = isStationA ? (loop?.substation_name_a || dev.name) : (loop?.substation_name_b || dev.name);
                const stCode = isStationA ? (loop?.substation_code_a || dev.device_code) : (loop?.substation_code_b || dev.device_code);

                return (
                  <div
                    key={`node-st-${node.device_id}-${index}`}
                    onMouseDown={e => handleNodeMouseDown(e, node.device_id)}
                    style={{ transform: `translate(${node.pos_x}px, ${node.pos_y}px)` }}
                    className={`
                      absolute w-[240px] bg-slate-900 border-2 rounded-xl p-3.5 shadow-xl transition-all pointer-events-auto cursor-grab active:cursor-grabbing
                      ${isNodeFaulty ? 'border-rose-500 ring-4 ring-rose-500/40 shadow-rose-500/30' : isSelected ? 'border-amber-400 ring-4 ring-amber-400/20 shadow-amber-500/20' : 'border-amber-600/80 hover:border-amber-500'}
                      ${isConnectSource ? 'border-emerald-400 ring-4 ring-emerald-400/30 animate-pulse' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-amber-900/50 mb-2">
                      <div className="flex items-center space-x-1.5 text-amber-400">
                        <Building2 className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-wider">{sideName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isNodeFaulty && (
                          <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded text-[9px] font-bold animate-pulse">
                            🔴 Lỗi
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold rounded">
                          110 kV
                        </span>
                      </div>
                    </div>

                    <h4 className="text-xs font-bold text-white truncate mb-1" title={stName}>
                      {stName}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Mã trạm:</span>
                      <strong className="text-amber-300 font-mono">{stCode || 'TBA-110kV'}</strong>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Nguồn cấp:</span>
                      <span className="text-emerald-400 font-bold flex items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping mr-1" /> Sẵn sàng
                      </span>
                    </div>
                  </div>
                );
              }

              // 2. RENDER FEEDER CARD (Phát tuyến A / B)
              if (isFeeder) {
                const sideFeeder = isFeederA ? 'PHÁT TUYẾN A' : 'PHÁT TUYẾN B';
                const fdName = isFeederA ? (loop?.feeder_name_a || dev.name) : (loop?.feeder_name_b || dev.name);
                const fdCode = isFeederA ? (loop?.feeder_code_a || dev.device_code) : (loop?.feeder_code_b || dev.device_code);

                return (
                  <div
                    key={`node-fd-${node.device_id}-${index}`}
                    onMouseDown={e => handleNodeMouseDown(e, node.device_id)}
                    style={{ transform: `translate(${node.pos_x}px, ${node.pos_y}px)` }}
                    className={`
                      absolute w-[220px] bg-slate-900 border-2 rounded-xl p-3 shadow-xl transition-all pointer-events-auto cursor-grab active:cursor-grabbing
                      ${isNodeFaulty ? 'border-rose-500 ring-4 ring-rose-500/40 shadow-rose-500/30' : isSelected ? 'border-sky-400 ring-4 ring-sky-400/20 shadow-sky-500/20' : 'border-sky-600/70 hover:border-sky-500'}
                      ${isConnectSource ? 'border-emerald-400 ring-4 ring-emerald-400/30 animate-pulse' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-sky-900/50 mb-1.5">
                      <div className="flex items-center space-x-1.5 text-sky-400">
                        <GitCommitHorizontal className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-wider">{sideFeeder}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isNodeFaulty && (
                          <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded text-[9px] font-bold animate-pulse">
                            🔴 Lỗi
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 bg-sky-500/20 text-sky-300 text-[10px] font-mono font-bold rounded">
                          22 kV
                        </span>
                      </div>
                    </div>

                    <h4 className="text-xs font-bold text-white truncate mb-1" title={fdName}>
                      {fdName}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Mã lộ tuyến:</span>
                      <strong className="text-sky-300 font-mono">{fdCode || 'PT-22kV'}</strong>
                    </div>
                  </div>
                );
              }

              // 3. RENDER MAIN LOOP DEVICE CARD (ĐIỂM DỪNG PHÁP LÝ - TRUNG TÂM KHÉP MẠCH)
              if (isMainLoopDev) {
                const switchStatus = (dev.switch_status || loop?.loop_device_switch_status || (loop?.operation_status === 'CLOSED' || loop?.status === 'CLOSED' ? 'CLOSED' : 'OPEN')) === 'CLOSED' ? 'CLOSED' : 'OPEN';
                const devPole = loop?.loop_device_pole || dev.pole_number;
                const devTeam = loop?.loop_device_team || loop?.loop_device_unit || dev.team;
                const devLat = loop?.latitude || loop?.loop_device_latitude || dev.latitude;
                const devLng = loop?.longitude || loop?.loop_device_longitude || dev.longitude;
                const mapsUrl = loop?.google_maps_url || loop?.loop_device_maps_url || dev.google_maps_url;

                return (
                  <div
                    key={`node-main-${node.device_id}-${index}`}
                    onMouseDown={e => handleNodeMouseDown(e, node.device_id)}
                    style={{ transform: `translate(${node.pos_x}px, ${node.pos_y}px)` }}
                    className={`
                      absolute w-[300px] bg-gradient-to-b from-slate-900 via-purple-950/70 to-slate-900 border-2 rounded-2xl p-4.5 shadow-[0_0_35px_rgba(245,158,11,0.35)] transition-all pointer-events-auto cursor-grab active:cursor-grabbing
                      ${isNodeFaulty ? 'border-rose-500 ring-4 ring-rose-500/50 shadow-rose-500/40' : isSelected ? 'border-amber-300 ring-4 ring-amber-400/50 shadow-amber-500/40 scale-105' : 'border-amber-400 ring-2 ring-amber-400/30 hover:border-amber-300 hover:scale-102'}
                      ${isConnectSource ? 'border-emerald-400 ring-4 ring-emerald-400/50 animate-pulse' : ''}
                    `}
                  >
                    {/* Glowing Accent Top Bar for Điểm Dừng Pháp Lý */}
                    <div className="bg-gradient-to-r from-amber-500 via-purple-600 to-amber-500 p-2 rounded-xl shadow-md mb-3 flex items-center justify-between text-white border border-amber-300/40">
                      <div className="flex items-center space-x-1.5 font-black text-[11px] uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-amber-200 animate-spin-slow" />
                        <span className="drop-shadow-xs font-black text-amber-100">⭐ ĐIỂM DỪNG PHÁP LÝ ⭐</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isNodeFaulty && (
                          <span className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[9px] font-black animate-pulse shadow-xs">
                            🔴 Lỗi
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-slate-950/80 text-amber-300 border border-amber-400/50 text-[10px] font-black rounded-lg">
                          {dev.device_type || loop?.loop_device_type || 'LBS'}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-sm font-black text-white truncate mb-1" title={dev.name}>
                      {dev.name || loop?.name}
                    </h4>

                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-mono text-amber-300 font-bold truncate bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40">
                        Mã TB: {dev.device_code || dev.device_id}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
                        Tâm điểm mạch
                      </span>
                    </div>

                    {/* Switch Status Pill (Ẩn trạng thái vận hành, hiển thị trạng thái đóng cắt) */}
                    <div className="p-2.5 bg-slate-950/95 rounded-xl border border-amber-500/40 space-y-1.5 text-[11px] mb-2.5 shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 font-medium">Trạng thái đóng cắt:</span>
                        <span
                          className={`font-black px-2.5 py-0.5 rounded text-[10px] tracking-wide shadow-xs ${
                            switchStatus === 'CLOSED'
                              ? 'bg-emerald-500 text-slate-950 font-black'
                              : 'bg-rose-500 text-white font-black'
                          }`}
                        >
                          {switchStatus === 'CLOSED' ? 'ĐÓNG (Closed)' : 'MỞ (Open)'}
                        </span>
                      </div>

                      {devPole && (
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-rose-400" /> Vị trí trụ:
                          </span>
                          <strong className="font-mono text-amber-200">{devPole}</strong>
                        </div>
                      )}

                      {devTeam && (
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400">Đội QLVH:</span>
                          <strong className="text-white truncate max-w-[140px]">{devTeam}</strong>
                        </div>
                      )}
                    </div>

                    {/* GPS Coordinates & Google Maps */}
                    {devLat && devLng && (
                      <div className="pt-2 border-t border-purple-900/50 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 font-mono">
                          {Number(devLat).toFixed(4)}, {Number(devLng).toFixed(4)}
                        </span>
                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1 px-2 py-0.5 bg-sky-500/20 text-sky-300 border border-sky-400/40 rounded hover:bg-sky-500/30 font-bold transition-colors"
                          >
                            <span>Google Maps</span>
                            <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              // 4. RENDER STANDARD DEVICE CARD (Thiết bị A / B / Thiết bị trung gian)
              const isSideA = node.pos_x < 900;
              const badgeLabel = isSideA ? 'THIẾT BỊ ĐẦU A' : 'THIẾT BỊ ĐẦU B';

              return (
                <div
                  key={`node-dev-${node.device_id}-${index}`}
                  onMouseDown={e => handleNodeMouseDown(e, node.device_id)}
                  style={{ transform: `translate(${node.pos_x}px, ${node.pos_y}px)` }}
                  className={`
                    absolute w-[210px] bg-slate-900 border-2 rounded-xl p-3 shadow-xl transition-all pointer-events-auto cursor-grab active:cursor-grabbing
                    ${isNodeFaulty ? 'border-rose-500 ring-4 ring-rose-500/40 shadow-rose-500/30' : isSelected ? 'border-emerald-400 ring-4 ring-emerald-400/20 shadow-emerald-500/20' : 'border-slate-800 hover:border-slate-700'}
                    ${isConnectSource ? 'border-emerald-400 ring-4 ring-emerald-400/30 animate-pulse' : ''}
                  `}
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 mb-1.5">
                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase rounded">
                      {dev.device_type || 'LBS'}
                    </span>
                    <div className="flex items-center gap-1">
                      {isNodeFaulty && (
                        <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded text-[9px] font-bold animate-pulse">
                          🔴 Lỗi
                        </span>
                      )}
                      <span className="text-[10px] font-mono font-bold text-slate-400 truncate">
                        {node.device_id}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-white truncate mb-1" title={dev.name}>
                    {dev.name}
                  </h4>

                  <p className="text-[10px] text-slate-400 truncate mb-2">
                    {dev.pole_number ? `Trụ ${dev.pole_number}` : 'Chưa gắn trụ'} • {badgeLabel}
                  </p>

                  <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Trạng thái:</span>
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded ${
                          dev.switch_status === 'CLOSED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : dev.switch_status === 'OPEN'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {dev.switch_status === 'CLOSED' ? 'ĐÓNG (Closed)' : dev.switch_status === 'OPEN' ? 'MỞ (Open)' : 'Không rõ'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">SCADA:</span>
                      <span className="flex items-center font-bold text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping mr-1" /> Có tín hiệu
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Empty Canvas Prompt */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-slate-500 pointer-events-none">
            <Activity className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-300 mb-1">Sơ đồ Topology trống</h3>
            <p className="text-xs text-slate-500 max-w-sm mb-4">
              Bấm nút <strong>[ ⚡ KHÉP VÒNG CHUẨN 7 NÚT ]</strong> hoặc <strong>[ + Thêm Thiết Bị ]</strong> phía trên để khởi tạo sơ đồ.
            </p>
          </div>
        )}
      </div>

      {/* Footer Legend */}
      <div className="z-20 bg-slate-900 border-t border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1.5" /> Trạm 110kV
          </span>
          <span className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 mr-1.5" /> Phát tuyến 22kV
          </span>
          <span className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 mr-1.5" /> Điểm Dừng Pháp Lý
          </span>
          <span className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5" /> ĐÓNG / Có SCADA
          </span>
          <span className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5" /> MỞ
          </span>
        </div>
        <div className="text-slate-500 text-[10px]">
          Kéo thả node để di chuyển • Cuộn chuột để Zoom • Click đúp để mở chi tiết
        </div>
      </div>

      {/* MODAL 1: ADD EXISTING DEVICE TO CANVAS */}
      {isAddDeviceOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-white text-sm">Chọn thiết bị có sẵn trong Database vào Sơ đồ</h3>
              </div>
              <button onClick={() => setIsAddDeviceOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-slate-800 bg-slate-900">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm theo DEVICE_ID, Tên thiết bị, Vị trí trụ, Loại, Trạm, Phát tuyến..."
                  value={deviceSearchTerm}
                  onChange={e => setDeviceSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Device Table List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-800/60 text-xs">
              {filteredSystemDevices.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Không tìm thấy thiết bị phù hợp</p>
              ) : (
                filteredSystemDevices.map(device => {
                  const isOnCanvas = nodes.some(n => n.device_id === device.device_id);
                  return (
                    <div
                      key={device.id}
                      className="py-3 flex items-center justify-between hover:bg-slate-800/50 px-2 rounded-lg transition-colors"
                    >
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-bold text-white">{device.name}</span>
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded">
                            {device.device_id}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-bold rounded">
                            {device.device_type}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {device.pole_number || 'Trụ -'} • {device.substation_code || 'Trạm -'} • {device.feeder_code || 'Phát tuyến -'}
                        </p>
                      </div>

                      <button
                        onClick={() => handleSelectDeviceToAdd(device)}
                        disabled={isOnCanvas}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                          isOnCanvas
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                      >
                        {isOnCanvas ? 'Đã có trên sơ đồ' : 'Chọn vào sơ đồ'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD INTERMEDIATE DEVICE BETWEEN */}
      {isAddBetweenOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Split className="w-5 h-5 text-purple-500" />
                <h3 className="font-bold text-white text-sm">Thêm Thiết Bị Trung Gian Vào Giữa 2 Thiết Bị</h3>
              </div>
              <button onClick={() => setIsAddBetweenOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-purple-950/30 border-b border-purple-900/50 text-xs text-purple-200">
              Ví dụ: Khi chèn một Dao cách ly (DS) vào giữa LBS và Recloser, sơ đồ sẽ tự động tách đường dây kết nối cũ thành 2 đường dây mới chèn qua thiết bị trung gian.
            </div>

            {/* Device Table List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-800/60 text-xs">
              {systemDevices.map(device => {
                const isOnCanvas = nodes.some(n => n.device_id === device.device_id);
                return (
                  <div
                    key={device.id}
                    className="py-3 flex items-center justify-between hover:bg-slate-800/50 px-2 rounded-lg transition-colors"
                  >
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-bold text-white">{device.name}</span>
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded">
                          {device.device_id}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Loại: {device.device_type} • {device.pole_number || 'Trụ -'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleAddIntermediateDevice(device)}
                      disabled={isOnCanvas}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                        isOnCanvas
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          : 'bg-purple-600 hover:bg-purple-500 text-white'
                      }`}
                    >
                      {isOnCanvas ? 'Đã có trên sơ đồ' : 'Chèn vào giữa'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REPLACE DEVICE */}
      {isReplaceDeviceOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Replace className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-white text-sm">Thay Thế Thiết Bị Trên Sơ Đồ</h3>
              </div>
              <button onClick={() => setIsReplaceDeviceOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 bg-slate-900 text-xs text-slate-300">
              Đang thay thế thiết bị: <strong className="text-amber-400">{selectedNodeId}</strong>. Chọn thiết bị mới từ danh sách bên dưới:
            </div>

            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-800/60 text-xs">
              {systemDevices.map(device => {
                return (
                  <div
                    key={device.id}
                    className="py-3 flex items-center justify-between hover:bg-slate-800/50 px-2 rounded-lg transition-colors"
                  >
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-bold text-white">{device.name}</span>
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded">
                          {device.device_id}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Loại: {device.device_type} • {device.pole_number || 'Trụ -'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleInitiateReplace(device)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs"
                    >
                      Chọn thay thế
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM REPLACE MODAL */}
      {replaceConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center space-x-3 text-amber-400 mb-4">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Xác nhận Thay Thế Thiết Bị</h3>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Bạn có chắc chắn muốn thay thế thiết bị <strong className="text-white">{replaceConfirmModal.oldDevice?.name} ({replaceConfirmModal.oldDevice?.device_id})</strong> bằng <strong className="text-amber-400">{replaceConfirmModal.newDevice?.name} ({replaceConfirmModal.newDevice?.device_id})</strong>?
            </p>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 mb-6 space-y-1">
              <div className="flex justify-between">
                <span>Các kết nối bị ảnh hưởng:</span>
                <strong className="text-amber-400">{replaceConfirmModal.affectedEdgesCount} kết nối</strong>
              </div>
              <p className="text-[10px] text-slate-500">
                Toàn bộ kết nối đường dây hiện có sẽ tự động chuyển hướng sang thiết bị mới mà KHÔNG làm gián đoạn sơ đồ topology.
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setReplaceConfirmModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmReplaceDevice}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-lg"
              >
                Xác nhận thay thế
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOPOLOGY DIAGNOSTICS & VALIDATION REPORT MODAL */}
      <TopologyDiagnosticsModal
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setIsDiagnosticsModalOpen(false)}
        report={validationReport}
        loopName={loop?.name}
        loopCode={loop?.loop_id}
        onFocusNode={handleFocusNode}
        onEditLoop={onEditLoop && loop ? () => onEditLoop(loop.id || loop.loop_id) : undefined}
      />
    </div>
  );
};
