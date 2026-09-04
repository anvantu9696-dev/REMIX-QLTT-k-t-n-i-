import { Loop, TopologyNode, TopologyEdge, Device, Feeder, Substation } from '../types';

export interface TopologyValidationItem {
  id: string;
  category: 'STRUCTURE' | 'RELATION' | 'EDGE' | 'DATABASE_CONSISTENCY' | 'DUPLICATION';
  label: string;
  status: 'VALID' | 'INVALID';
  message: string;
  nodeId?: string;
  edgeKey?: string;
  details?: string;
}

export interface TopologyValidationReport {
  loopId: string | number;
  loopCode: string;
  isValid: boolean;
  errorCount: number;
  validCount: number;
  items: TopologyValidationItem[];
  checkedAt: string;
  highlightedNodeIds: string[];
  highlightedEdgeKeys: string[];
}

interface ValidationContext {
  loop: Loop | null;
  nodes?: TopologyNode[];
  edges?: TopologyEdge[];
  allLoops?: Loop[];
  allDevices?: Device[];
  allFeeders?: Feeder[];
  allSubstations?: Substation[];
}

/**
 * Validate a loop topology according to flexible multi-node ring standards:
 * Substation A → Feeder A → [Devices Head A...] → Legal Stop Point → [Devices Head B...] → Feeder B → Substation B
 * 
 * STRICT RULES:
 * - Read-only detection and reporting.
 * - Supports arbitrary number of nodes (multi-node topology).
 * - Does NOT alter, delete or create any data.
 */
export function validateTopology(ctx: ValidationContext): TopologyValidationReport {
  const {
    loop,
    nodes = [],
    edges = [],
    allLoops = [],
    allDevices = [],
    allFeeders = [],
    allSubstations = []
  } = ctx;

  const items: TopologyValidationItem[] = [];
  const highlightedNodeIds: string[] = [];
  const highlightedEdgeKeys: string[] = [];

  const loopCode = loop?.loop_id || loop?.name || 'Chưa định danh';
  const loopId = loop?.id || 0;

  if (!loop) {
    return {
      loopId: 0,
      loopCode: 'UNKNOWN',
      isValid: false,
      errorCount: 1,
      validCount: 0,
      items: [
        {
          id: 'MISSING_LOOP_DATA',
          category: 'STRUCTURE',
          label: 'Dữ liệu Khép vòng',
          status: 'INVALID',
          message: 'Không tìm thấy dữ liệu Khép vòng để kiểm tra.'
        }
      ],
      checkedAt: new Date().toLocaleTimeString('vi-VN'),
      highlightedNodeIds: [],
      highlightedEdgeKeys: []
    };
  }

  // 1. DUPLICATION CHECK (Khép vòng trùng mã)
  if (allLoops.length > 0) {
    const duplicates = allLoops.filter(
      l => l.id !== loop.id && (
        (loop.loop_id && l.loop_id?.toLowerCase() === loop.loop_id?.toLowerCase()) ||
        (loop.name && l.name?.toLowerCase() === loop.name?.toLowerCase())
      )
    );
    if (duplicates.length > 0) {
      items.push({
        id: 'DUPLICATE_LOOP_CODE',
        category: 'DUPLICATION',
        label: 'Kiểm tra trùng mã Khép vòng',
        status: 'INVALID',
        message: `Mã hoặc tên Khép vòng '${loopCode}' bị trùng với ${duplicates.length} Khép vòng khác trong hệ thống.`,
        details: duplicates.map(d => `ID #${d.id}: ${d.name} (${d.loop_id})`).join(', ')
      });
    } else {
      items.push({
        id: 'DUPLICATE_LOOP_CODE',
        category: 'DUPLICATION',
        label: 'Kiểm tra trùng mã Khép vòng',
        status: 'VALID',
        message: 'Mã Khép vòng là duy nhất trong hệ thống.'
      });
    }
  }

  // 2. CHECK CORE STRUCTURAL CONFIGURATION IN DATABASE
  // 2.1 Trạm A (Substation A)
  const hasSubstationA = Boolean(loop.substation_id_a || loop.substation_code_a || loop.substation_name_a);
  const stAId = `STA_${loop.substation_id_a || 'A'}`;

  let stADbExists = true;
  if (allSubstations.length > 0 && loop.substation_id_a) {
    stADbExists = allSubstations.some(s => s.id === loop.substation_id_a || s.substation_code === loop.substation_code_a);
  }

  if (!hasSubstationA) {
    items.push({
      id: 'MISSING_SUBSTATION_A',
      category: 'STRUCTURE',
      label: 'Trạm 110kV A',
      status: 'INVALID',
      message: 'Thiếu Trạm A trong cấu hình Khép vòng.'
    });
  } else if (!stADbExists) {
    items.push({
      id: 'INVALID_SUBSTATION_A_ID',
      category: 'DATABASE_CONSISTENCY',
      label: 'Trạm 110kV A',
      status: 'INVALID',
      message: `ID Trạm A (#${loop.substation_id_a} - ${loop.substation_code_a || ''}) không tồn tại trong Database.`,
      nodeId: stAId
    });
    highlightedNodeIds.push(stAId);
  } else {
    items.push({
      id: 'SUBSTATION_A_VALID',
      category: 'STRUCTURE',
      label: 'Trạm A hợp lệ',
      status: 'VALID',
      message: `Trạm A: ${loop.substation_name_a || loop.substation_code_a || 'Hợp lệ'}`
    });
  }

  // 2.2 Phát tuyến A (Feeder A)
  const hasFeederA = Boolean(loop.feeder_id_a || loop.feeder_code_a || loop.feeder_name_a);
  const fAId = `FDA_${loop.feeder_id_a || 'A'}`;

  let fADbExists = true;
  let fAMatchesSubstation = true;
  if (allFeeders.length > 0 && loop.feeder_id_a) {
    const fObj = allFeeders.find(f => f.id === loop.feeder_id_a || f.feeder_code === loop.feeder_code_a);
    if (!fObj) {
      fADbExists = false;
    } else if (loop.substation_id_a && fObj.substation_id && fObj.substation_id !== loop.substation_id_a) {
      fAMatchesSubstation = false;
    }
  }

  if (!hasFeederA) {
    items.push({
      id: 'MISSING_FEEDER_A',
      category: 'STRUCTURE',
      label: 'Phát tuyến A',
      status: 'INVALID',
      message: 'Thiếu Phát tuyến A trong cấu hình Khép vòng.'
    });
  } else if (!fADbExists) {
    items.push({
      id: 'INVALID_FEEDER_A_ID',
      category: 'DATABASE_CONSISTENCY',
      label: 'Phát tuyến A',
      status: 'INVALID',
      message: `ID Phát tuyến A (#${loop.feeder_id_a} - ${loop.feeder_code_a || ''}) không tồn tại trong Database.`,
      nodeId: fAId
    });
    highlightedNodeIds.push(fAId);
  } else if (!fAMatchesSubstation) {
    items.push({
      id: 'FEEDER_A_SUBSTATION_MISMATCH',
      category: 'RELATION',
      label: 'Phát tuyến A không thuộc đúng Trạm A',
      status: 'INVALID',
      message: `Phát tuyến A (${loop.feeder_code_a || loop.feeder_name_a}) không thuộc Trạm A (${loop.substation_code_a || ''}) trong Database.`,
      nodeId: fAId
    });
    highlightedNodeIds.push(fAId);
  } else {
    items.push({
      id: 'FEEDER_A_VALID',
      category: 'STRUCTURE',
      label: 'Phát tuyến A hợp lệ',
      status: 'VALID',
      message: `Phát tuyến A: ${loop.feeder_name_a || loop.feeder_code_a || 'Hợp lệ'}`
    });
  }

  // 2.3 Điểm dừng pháp lý (Main Loop Device)
  const hasLoopDev = Boolean(loop.loop_device_id || loop.loop_device_code || loop.loop_device_name);
  const loopDevId = String(loop.loop_device_id || loop.loop_device_code || 'DEV_LOOP_MAIN');

  let loopDevDbExists = true;
  if (allDevices.length > 0 && loop.loop_device_id) {
    const ldObj = allDevices.find(d => String(d.id) === String(loop.loop_device_id) || d.device_id === String(loop.loop_device_id) || d.device_code === loop.loop_device_code);
    if (!ldObj) {
      loopDevDbExists = false;
    }
  }

  if (!hasLoopDev) {
    items.push({
      id: 'MISSING_LOOP_DEVICE',
      category: 'STRUCTURE',
      label: 'Điểm dừng pháp lý',
      status: 'INVALID',
      message: 'Thiếu Điểm dừng pháp lý (Điểm mở / khép mạch trung tâm).'
    });
  } else if (!loopDevDbExists) {
    items.push({
      id: 'INVALID_LOOP_DEVICE_ID',
      category: 'DATABASE_CONSISTENCY',
      label: 'Điểm dừng pháp lý',
      status: 'INVALID',
      message: `Mã/ID Điểm dừng pháp lý (${loop.loop_device_code || loop.loop_device_id}) không tồn tại trong Database thiết bị.`,
      nodeId: loopDevId
    });
    highlightedNodeIds.push(loopDevId);
  } else {
    items.push({
      id: 'LOOP_DEVICE_VALID',
      category: 'STRUCTURE',
      label: 'Điểm dừng pháp lý hợp lệ',
      status: 'VALID',
      message: `Điểm dừng pháp lý: ${loop.loop_device_name || loop.loop_device_code || 'Hợp lệ'}`
    });
  }

  // 2.4 Phát tuyến B (Feeder B)
  const hasFeederB = Boolean(loop.feeder_id_b || loop.feeder_code_b || loop.feeder_name_b);
  const fBId = `FDB_${loop.feeder_id_b || 'B'}`;

  let fBDbExists = true;
  let fBMatchesSubstation = true;
  if (allFeeders.length > 0 && loop.feeder_id_b) {
    const fObj = allFeeders.find(f => f.id === loop.feeder_id_b || f.feeder_code === loop.feeder_code_b);
    if (!fObj) {
      fBDbExists = false;
    } else if (loop.substation_id_b && fObj.substation_id && fObj.substation_id !== loop.substation_id_b) {
      fBMatchesSubstation = false;
    }
  }

  if (!hasFeederB) {
    items.push({
      id: 'MISSING_FEEDER_B',
      category: 'STRUCTURE',
      label: 'Phát tuyến B',
      status: 'INVALID',
      message: 'Thiếu Phát tuyến B trong cấu hình Khép vòng.'
    });
  } else if (!fBDbExists) {
    items.push({
      id: 'INVALID_FEEDER_B_ID',
      category: 'DATABASE_CONSISTENCY',
      label: 'Phát tuyến B',
      status: 'INVALID',
      message: `ID Phát tuyến B (#${loop.feeder_id_b} - ${loop.feeder_code_b || ''}) không tồn tại trong Database.`,
      nodeId: fBId
    });
    highlightedNodeIds.push(fBId);
  } else if (!fBMatchesSubstation) {
    items.push({
      id: 'FEEDER_B_SUBSTATION_MISMATCH',
      category: 'RELATION',
      label: 'Phát tuyến B không thuộc đúng Trạm B',
      status: 'INVALID',
      message: `Phát tuyến B (${loop.feeder_code_b || loop.feeder_name_b}) không thuộc Trạm B (${loop.substation_code_b || ''}) trong Database.`,
      nodeId: fBId
    });
    highlightedNodeIds.push(fBId);
  } else {
    items.push({
      id: 'FEEDER_B_VALID',
      category: 'STRUCTURE',
      label: 'Phát tuyến B hợp lệ',
      status: 'VALID',
      message: `Phát tuyến B: ${loop.feeder_name_b || loop.feeder_code_b || 'Hợp lệ'}`
    });
  }

  // 2.5 Trạm B (Substation B)
  const hasSubstationB = Boolean(loop.substation_id_b || loop.substation_code_b || loop.substation_name_b);
  const stBId = `STB_${loop.substation_id_b || 'B'}`;

  let stBDbExists = true;
  if (allSubstations.length > 0 && loop.substation_id_b) {
    stBDbExists = allSubstations.some(s => s.id === loop.substation_id_b || s.substation_code === loop.substation_code_b);
  }

  if (!hasSubstationB) {
    items.push({
      id: 'MISSING_SUBSTATION_B',
      category: 'STRUCTURE',
      label: 'Trạm 110kV B',
      status: 'INVALID',
      message: 'Thiếu Trạm B trong cấu hình Khép vòng.'
    });
  } else if (!stBDbExists) {
    items.push({
      id: 'INVALID_SUBSTATION_B_ID',
      category: 'DATABASE_CONSISTENCY',
      label: 'Trạm 110kV B',
      status: 'INVALID',
      message: `ID Trạm B (#${loop.substation_id_b} - ${loop.substation_code_b || ''}) không tồn tại trong Database.`,
      nodeId: stBId
    });
    highlightedNodeIds.push(stBId);
  } else {
    items.push({
      id: 'SUBSTATION_B_VALID',
      category: 'STRUCTURE',
      label: 'Trạm B hợp lệ',
      status: 'VALID',
      message: `Trạm B: ${loop.substation_name_b || loop.substation_code_b || 'Hợp lệ'}`
    });
  }

  // 3. MULTI-NODE SEQUENTIAL EDGE VALIDATION (Duyệt qua toàn bộ mảng nodes để kiểm tra kết nối tuần tự)
  if (nodes.length < 2) {
    items.push({
      id: 'INSUFFICIENT_NODES',
      category: 'STRUCTURE',
      label: 'Số lượng nút trên sơ đồ',
      status: 'INVALID',
      message: `Sơ đồ hiện chỉ có ${nodes.length} nút. Cần ít nhất 2 nút để tạo liên kết khép vòng.`
    });
  } else {
    items.push({
      id: 'MULTI_NODE_COUNT_VALID',
      category: 'STRUCTURE',
      label: 'Số lượng nút sơ đồ khép vòng đa nút',
      status: 'VALID',
      message: `Sơ đồ khép vòng đa nút linh hoạt hiện đang có ${nodes.length} nút.`
    });

    // Check sequential connection for all i to i + 1
    const hasConnection = (sourceId: string, targetId: string) => {
      return edges.some(
        e => (e.source_device_id === sourceId && e.target_device_id === targetId) ||
             (e.source_device_id === targetId && e.target_device_id === sourceId)
      );
    };

    const missingEdgeLinks: string[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const srcId = nodes[i].device_id;
      const tgtId = nodes[i + 1].device_id;
      if (!hasConnection(srcId, tgtId)) {
        const srcName = nodes[i].device?.name || srcId;
        const tgtName = nodes[i + 1].device?.name || tgtId;
        missingEdgeLinks.push(`Đứt đoạn: ${srcName} ↔ ${tgtName}`);
        highlightedEdgeKeys.push(`${srcId}->${tgtId}`);
      }
    }

    if (missingEdgeLinks.length > 0) {
      items.push({
        id: 'INVALID_EDGE_CHAIN',
        category: 'EDGE',
        label: 'Chuỗi liên kết Edge tuần tự',
        status: 'INVALID',
        message: `Sơ đồ đứt đoạn liên kết tuần tự: ${missingEdgeLinks.join('; ')}.`,
        details: 'Cần duy trì liên kết tuần tự liên tục từ Nguồn A qua các nút trung gian đến Nguồn B.'
      });
    } else {
      items.push({
        id: 'VALID_EDGE_CHAIN',
        category: 'EDGE',
        label: 'Chuỗi liên kết Edge tuần tự hợp lệ',
        status: 'VALID',
        message: `Tất cả ${nodes.length} nút trên sơ đồ khép vòng đa nút được kết nối tuần tự liên tục.`
      });
    }
  }

  const errorCount = items.filter(i => i.status === 'INVALID').length;
  const validCount = items.filter(i => i.status === 'VALID').length;
  const isValid = errorCount === 0;

  return {
    loopId,
    loopCode,
    isValid,
    errorCount,
    validCount,
    items,
    checkedAt: new Date().toLocaleTimeString('vi-VN'),
    highlightedNodeIds,
    highlightedEdgeKeys
  };
}
