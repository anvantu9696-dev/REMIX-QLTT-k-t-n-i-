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
 * Validate a loop topology according to EVN 7-node chain standards:
 * Trạm A → Phát tuyến A → Thiết bị A → Điểm dừng pháp lý → Thiết bị B → Phát tuyến B → Trạm B
 * 
 * STRICT RULES:
 * - Read-only detection and reporting.
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

  // 2. CHECK 7 CORE STRUCTURAL COMPONENTS (Trạm A -> PT A -> TB A -> TB Khép vòng -> TB B -> PT B -> Trạm B)

  // 2.1 Trạm A (Substation A)
  const hasSubstationA = Boolean(loop.substation_id_a || loop.substation_code_a || loop.substation_name_a);
  const stAId = `STA_${loop.substation_id_a || 'A'}`;
  const nodeSubstationA = nodes.find(n => n.device_id === stAId || (n.device_id || '').startsWith('STA_') || (n.device?.device_type === ('SUBSTATION' as any) && n.pos_x < 400));
  
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
  const nodeFeederA = nodes.find(n => n.device_id === fAId || (n.device_id || '').startsWith('FDA_') || (n.device?.device_type === ('FEEDER' as any) && n.pos_x < 700));

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

  // 2.3 Thiết bị đầu A (Device A)
  const hasDevA = Boolean(loop.device_id_a || loop.device_code_a || loop.device_name_a);
  const devAId = String(loop.device_id_a || loop.device_code_a || 'DEV_A');
  const nodeDevA = nodes.find(n => n.device_id === devAId || (n.pos_x > 400 && n.pos_x < 900 && n.device_id !== loop.loop_device_id));

  let devADbExists = true;
  let devAMatchesFeeder = true;
  if (allDevices.length > 0 && loop.device_id_a) {
    const dObj = allDevices.find(d => String(d.id) === String(loop.device_id_a) || d.device_id === String(loop.device_id_a) || d.device_code === loop.device_code_a);
    if (!dObj) {
      devADbExists = false;
    } else if (loop.feeder_code_a && dObj.feeder_code && dObj.feeder_code.toUpperCase() !== loop.feeder_code_a.toUpperCase()) {
      devAMatchesFeeder = false;
    }
  }

  if (!hasDevA) {
    items.push({
      id: 'MISSING_DEVICE_A',
      category: 'STRUCTURE',
      label: 'Thiết bị A',
      status: 'INVALID',
      message: 'Thiếu Thiết bị A trong cấu hình Khép vòng.'
    });
  } else if (!devADbExists) {
    items.push({
      id: 'INVALID_DEVICE_A_ID',
      category: 'DATABASE_CONSISTENCY',
      label: 'Thiết bị A',
      status: 'INVALID',
      message: `Mã/ID Thiết bị A (${loop.device_code_a || loop.device_id_a}) không tồn tại trong Database thiết bị.`,
      nodeId: devAId
    });
    highlightedNodeIds.push(devAId);
  } else if (!devAMatchesFeeder) {
    items.push({
      id: 'DEVICE_A_FEEDER_MISMATCH',
      category: 'RELATION',
      label: 'Thiết bị A không thuộc đúng Phát tuyến A',
      status: 'INVALID',
      message: `Thiết bị A (${loop.device_code_a || loop.device_name_a}) không thuộc Phát tuyến ${loop.feeder_code_a}.`,
      nodeId: devAId
    });
    highlightedNodeIds.push(devAId);
  } else {
    items.push({
      id: 'DEVICE_A_VALID',
      category: 'STRUCTURE',
      label: 'Thiết bị A hợp lệ',
      status: 'VALID',
      message: `Thiết bị A: ${loop.device_name_a || loop.device_code_a || 'Hợp lệ'}`
    });
  }

  // 2.4 Thiết bị Khép vòng chính (Main Loop Device - Tâm điểm)
  const hasLoopDev = Boolean(loop.loop_device_id || loop.loop_device_code || loop.loop_device_name);
  const loopDevId = String(loop.loop_device_id || loop.loop_device_code || 'DEV_LOOP_MAIN');
  const nodeLoopDev = nodes.find(n => n.device_id === loopDevId || n.device_id === 'DEV_LOOP_MAIN' || (n.pos_x >= 850 && n.pos_x <= 1150));

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

  // 2.5 Thiết bị đầu B (Device B)
  const hasDevB = Boolean(loop.device_id_b || loop.device_code_b || loop.device_name_b);
  const devBId = String(loop.device_id_b || loop.device_code_b || 'DEV_B');
  const nodeDevB = nodes.find(n => n.device_id === devBId || (n.pos_x > 1150 && n.pos_x < 1550 && n.device_id !== loop.loop_device_id));

  let devBDbExists = true;
  let devBMatchesFeeder = true;
  if (allDevices.length > 0 && loop.device_id_b) {
    const dObj = allDevices.find(d => String(d.id) === String(loop.device_id_b) || d.device_id === String(loop.device_id_b) || d.device_code === loop.device_code_b);
    if (!dObj) {
      devBDbExists = false;
    } else if (loop.feeder_code_b && dObj.feeder_code && dObj.feeder_code.toUpperCase() !== loop.feeder_code_b.toUpperCase()) {
      devBMatchesFeeder = false;
    }
  }

  if (!hasDevB) {
    items.push({
      id: 'MISSING_DEVICE_B',
      category: 'STRUCTURE',
      label: 'Thiết bị B',
      status: 'INVALID',
      message: 'Thiếu Thiết bị B trong cấu hình Khép vòng.'
    });
  } else if (!devBDbExists) {
    items.push({
      id: 'INVALID_DEVICE_B_ID',
      category: 'DATABASE_CONSISTENCY',
      label: 'Thiết bị B',
      status: 'INVALID',
      message: `Mã/ID Thiết bị B (${loop.device_code_b || loop.device_id_b}) không tồn tại trong Database thiết bị.`,
      nodeId: devBId
    });
    highlightedNodeIds.push(devBId);
  } else if (!devBMatchesFeeder) {
    items.push({
      id: 'DEVICE_B_FEEDER_MISMATCH',
      category: 'RELATION',
      label: 'Thiết bị B không thuộc đúng Phát tuyến B',
      status: 'INVALID',
      message: `Thiết bị B (${loop.device_code_b || loop.device_name_b}) không thuộc Phát tuyến ${loop.feeder_code_b}.`,
      nodeId: devBId
    });
    highlightedNodeIds.push(devBId);
  } else {
    items.push({
      id: 'DEVICE_B_VALID',
      category: 'STRUCTURE',
      label: 'Thiết bị B hợp lệ',
      status: 'VALID',
      message: `Thiết bị B: ${loop.device_name_b || loop.device_code_b || 'Hợp lệ'}`
    });
  }

  // 2.6 Phát tuyến B (Feeder B)
  const hasFeederB = Boolean(loop.feeder_id_b || loop.feeder_code_b || loop.feeder_name_b);
  const fBId = `FDB_${loop.feeder_id_b || 'B'}`;
  const nodeFeederB = nodes.find(n => n.device_id === fBId || (n.device_id || '').startsWith('FDB_') || (n.device?.device_type === ('FEEDER' as any) && n.pos_x > 1400));

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

  // 2.7 Trạm B (Substation B)
  const hasSubstationB = Boolean(loop.substation_id_b || loop.substation_code_b || loop.substation_name_b);
  const stBId = `STB_${loop.substation_id_b || 'B'}`;
  const nodeSubstationB = nodes.find(n => n.device_id === stBId || (n.device_id || '').startsWith('STB_') || (n.device?.device_type === ('SUBSTATION' as any) && n.pos_x > 1700));

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

  // 3. GRAPH EDGES & SEQUENTIAL ORDER VALIDATION (Kiểm tra liên kết Edge và thứ tự)
  if (nodes.length > 0 && edges.length > 0) {
    const hasConnection = (sourceId: string, targetId: string) => {
      return edges.some(
        e => (e.source_device_id === sourceId && e.target_device_id === targetId) ||
             (e.source_device_id === targetId && e.target_device_id === sourceId)
      );
    };

    const actualStAId = nodeSubstationA?.device_id || stAId;
    const actualFAId = nodeFeederA?.device_id || fAId;
    const actualDevAId = nodeDevA?.device_id || devAId;
    const actualLoopDevId = nodeLoopDev?.device_id || loopDevId;
    const actualDevBId = nodeDevB?.device_id || devBId;
    const actualFBId = nodeFeederB?.device_id || fBId;
    const actualStBId = nodeSubstationB?.device_id || stBId;

    // Check 6 mandatory sequential edges
    const e1 = hasConnection(actualStAId, actualFAId);
    const e2 = hasConnection(actualFAId, actualDevAId);
    const e3 = hasConnection(actualDevAId, actualLoopDevId);
    const e4 = hasConnection(actualLoopDevId, actualDevBId);
    const e5 = hasConnection(actualDevBId, actualFBId);
    const e6 = hasConnection(actualFBId, actualStBId);

    const edgeChainErrors: string[] = [];
    if (!e1) {
      edgeChainErrors.push('Thiếu liên kết: Trạm A ↔ Phát tuyến A');
      highlightedEdgeKeys.push(`${actualStAId}->${actualFAId}`);
    }
    if (!e2) {
      edgeChainErrors.push('Thiếu liên kết: Phát tuyến A ↔ Thiết bị A');
      highlightedEdgeKeys.push(`${actualFAId}->${actualDevAId}`);
    }
    if (!e3) {
      edgeChainErrors.push('Thiếu liên kết: Thiết bị A ↔ TB Khép vòng');
      highlightedEdgeKeys.push(`${actualDevAId}->${actualLoopDevId}`);
    }
    if (!e4) {
      edgeChainErrors.push('Thiếu liên kết: TB Khép vòng ↔ Thiết bị B');
      highlightedEdgeKeys.push(`${actualLoopDevId}->${actualDevBId}`);
    }
    if (!e5) {
      edgeChainErrors.push('Thiếu liên kết: Thiết bị B ↔ Phát tuyến B');
      highlightedEdgeKeys.push(`${actualDevBId}->${actualFBId}`);
    }
    if (!e6) {
      edgeChainErrors.push('Thiếu liên kết: Phát tuyến B ↔ Trạm B');
      highlightedEdgeKeys.push(`${actualFBId}->${actualStBId}`);
    }

    if (edgeChainErrors.length > 0) {
      items.push({
        id: 'INVALID_EDGE_CHAIN',
        category: 'EDGE',
        label: 'Edge không đúng thứ tự cấu trúc chuẩn',
        status: 'INVALID',
        message: `Sơ đồ bị đứt đoạn hoặc thiếu liên kết trong chuỗi 7 nút: ${edgeChainErrors.join('; ')}.`,
        details: 'Cần duy trì liên kết đầy đủ từ Trạm A qua TB Khép vòng đến Trạm B.'
      });
    } else {
      items.push({
        id: 'VALID_EDGE_CHAIN',
        category: 'EDGE',
        label: 'Chuỗi liên kết Edge tuần tự hợp lệ',
        status: 'VALID',
        message: 'Các liên kết giữa 7 nút tuân thủ chính xác thứ tự cấu trúc nguồn.'
      });
    }

    // 4. CHECK LOOP DEVICE IS LOCATED BETWEEN A AND B (TB Khép vòng chính nằm giữa A và B)
    if (nodeDevA && nodeLoopDev && nodeDevB) {
      const isPhysicallyBetween =
        (nodeDevA.pos_x < nodeLoopDev.pos_x && nodeLoopDev.pos_x < nodeDevB.pos_x) ||
        (nodeDevB.pos_x < nodeLoopDev.pos_x && nodeLoopDev.pos_x < nodeDevA.pos_x);
      
      const isTopologicallyConnected = e3 && e4;

      if (!isTopologicallyConnected || !isPhysicallyBetween) {
        items.push({
          id: 'LOOP_DEVICE_NOT_CENTERED',
          category: 'STRUCTURE',
          label: 'Vị trí Điểm dừng pháp lý',
          status: 'INVALID',
          message: 'Điểm dừng pháp lý không nằm giữa và không kết nối trực tiếp với Thiết bị A và Thiết bị B.',
          nodeId: actualLoopDevId
        });
        highlightedNodeIds.push(actualLoopDevId);
      } else {
        items.push({
          id: 'LOOP_DEVICE_CENTERED_VALID',
          category: 'STRUCTURE',
          label: 'Vị trí Điểm dừng pháp lý chuẩn',
          status: 'VALID',
          message: 'Điểm dừng pháp lý nằm đúng vị trí trung tâm giữa Thiết bị A và Thiết bị B.'
        });
      }
    }

    // 5. DATABASE VS GRAPH CONSISTENCY (Đồng nhất dữ liệu Database và Graph)
    const expectedDeviceIds = [
      stAId, fAId, devAId, loopDevId, devBId, fBId, stBId
    ];
    const graphDeviceIds = nodes.map(n => n.device_id);
    const missingOnGraph = expectedDeviceIds.filter(id => !graphDeviceIds.includes(id) && !graphDeviceIds.some(gid => gid.includes(id.replace('STA_', '').replace('FDA_', '').replace('FDB_', '').replace('STB_', ''))));

    if (missingOnGraph.length > 0 && nodes.length < 7) {
      items.push({
        id: 'DB_GRAPH_INCONSISTENCY',
        category: 'DATABASE_CONSISTENCY',
        label: 'Dữ liệu Database và Graph không đồng nhất',
        status: 'INVALID',
        message: `Graph hiện có ${nodes.length} nút, chưa đồng bộ đủ 7 nút chuẩn theo hồ sơ Khép vòng trong Database.`,
        details: `Các nút chưa xuất hiện đầy đủ trên sơ đồ: ${missingOnGraph.join(', ')}`
      });
    } else {
      items.push({
        id: 'DB_GRAPH_CONSISTENCY_VALID',
        category: 'DATABASE_CONSISTENCY',
        label: 'Dữ liệu Database và Graph đồng nhất',
        status: 'VALID',
        message: 'Các phần tử trên Graph đồng bộ chính xác với hồ sơ cấu hình trong Database.'
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
