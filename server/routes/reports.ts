import { Router, Response } from 'express';
import { dbQuery, dbQueryOne } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware';
import { CORE_DATA_SOURCE } from '../config';
import { deviceRepo } from '../repositories/firestore/deviceRepository';
import { substationRepo } from '../repositories/firestore/substationRepository';
import { feederRepo } from '../repositories/firestore/feederRepository';

const router = Router();
router.use(authenticateToken);

// 1. GET /api/reports/data - Generic export endpoint with filtering and permissions
router.get('/data', async (req: AuthenticatedRequest, res) => {
  const { type = 'devices', fromDate, toDate, team, substation, feeder, device_type, status } = req.query;

  try {
    // Permission check
    const userPermissions = req.user?.permissions || [];
    const userRoles = req.user?.roles || [];
    const isPrivileged = userRoles.some(r => ['ADMIN', 'CAN_BO_PHUONG_THUC', 'TRUONG_CA', 'DOI_TRUONG', 'QUAN_LY', 'LÃNH ĐẠO', 'PHO_CA', 'NHAN_VIEN_VAN_HANH', 'FIELD_OPERATOR'].includes(r));

    if (!userPermissions.includes('reports:read') && !userRoles.includes('ADMIN') && !isPrivileged && userPermissions.length > 0) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem báo cáo' });
    }

    if (type === 'devices' && !userPermissions.includes('devices:export') && !userPermissions.includes('GRID_DATA_IMPORT') && !userPermissions.includes('reports:read') && !userRoles.includes('ADMIN') && !isPrivileged) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xuất dữ liệu Thiết bị' });
    }
    if (type === 'substations' && !userPermissions.includes('substations:export') && !userPermissions.includes('GRID_DATA_IMPORT') && !userPermissions.includes('reports:read') && !userRoles.includes('ADMIN') && !isPrivileged) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xuất dữ liệu Trạm 110kV' });
    }
    if (type === 'feeders' && !userPermissions.includes('feeders:export') && !userPermissions.includes('GRID_DATA_IMPORT') && !userPermissions.includes('reports:read') && !userRoles.includes('ADMIN') && !isPrivileged) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xuất dữ liệu Phát tuyến' });
    }
    if (type === 'loops' && !userPermissions.includes('loops:export') && !userPermissions.includes('GRID_DATA_IMPORT') && !userPermissions.includes('reports:read') && !userRoles.includes('ADMIN') && !isPrivileged) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xuất dữ liệu Khép vòng' });
    }

    if (type === 'audit' && !userPermissions.includes('audit:read') && !userRoles.includes('ADMIN')) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem nhật ký audit' });
    }

    if (type === 'proposals' && !userPermissions.includes('proposals:read') && !userRoles.includes('ADMIN')) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem báo cáo đề xuất thiết bị' });
    }

    if (CORE_DATA_SOURCE === 'firestore') {
      if (type === 'devices') {
         const [devices, substations, feeders] = await Promise.all([
            deviceRepo.list(),
            substationRepo.list(),
            feederRepo.list()
         ]);
         const subMap = new Map(substations.map(s => [String(s.id), s]));
         const feederMap = new Map(feeders.map(f => [String(f.id), f]));
         let filteredDevices = devices.map(d => {
             const sub = subMap.get(String(d.substation_id));
             const fdr = feederMap.get(String(d.feeder_id));
             return {
                 id: d.id,
                 device_id: d.id, // For report formatting compatibility
                 device_code: d.name,
                 name: d.name,
                 device_type: d.device_type,
                 pole_number: d.pole_number,
                 feeder_code: fdr?.feeder_code || null,
                 feeder_name: fdr?.name || null,
                 substation_code: sub?.substation_code || null,
                 substation_name: sub?.name || null,
                 unit: d.unit,
                 team: d.team,
                 status: d.status,
                 latitude: d.latitude,
                 longitude: d.longitude,
                 notes: d.notes,
                 created_at: d.createdAt
             };
         });
         
         if (team) filteredDevices = filteredDevices.filter(d => d.team === team);
         if (substation) filteredDevices = filteredDevices.filter(d => d.substation_code === substation);
         if (feeder) filteredDevices = filteredDevices.filter(d => d.feeder_code === feeder);
         if (device_type) {
             const dbType = device_type.toString().toUpperCase() === 'REC' ? 'RCL' : device_type;
             filteredDevices = filteredDevices.filter(d => d.device_type === dbType);
         }
         if (status) filteredDevices = filteredDevices.filter(d => d.status === status);
         if (fromDate) filteredDevices = filteredDevices.filter(d => d.created_at && d.created_at >= (fromDate as string));
         if (toDate) filteredDevices = filteredDevices.filter(d => d.created_at && d.created_at <= ((toDate as string) + ' 23:59:59'));
         
         return res.json({ success: true, data: filteredDevices });
      }

      if (type === 'device_status') {
         const devices = await deviceRepo.list();
         const statusMap: Record<string, { total_count: number, total_lbs: number, total_rcl: number, total_ds: number, total_rmu: number }> = {};
         for (const d of devices) {
             const st = d.status || 'UNKNOWN';
             if (!statusMap[st]) {
                 statusMap[st] = { total_count: 0, total_lbs: 0, total_rcl: 0, total_ds: 0, total_rmu: 0 };
             }
             statusMap[st].total_count++;
             if (d.device_type === 'LBS') statusMap[st].total_lbs++;
             if (d.device_type === 'RCL' || d.device_type === 'REC') statusMap[st].total_rcl++;
             if (d.device_type === 'DS') statusMap[st].total_ds++;
             if (d.device_type === 'RMU') statusMap[st].total_rmu++;
         }
         const mapped = Object.keys(statusMap).map(k => ({
             status: k,
             ...statusMap[k]
         })).sort((a, b) => b.total_count - a.total_count);
         return res.json({ success: true, data: mapped });
      }

      if (type === 'substations') {
         const substations = await substationRepo.list();
         const data = substations.map(s => ({
             id: s.id,
             substation_code: s.substation_code,
             name: s.name,
             address: s.address,
             latitude: s.latitude,
             longitude: s.longitude,
             status: s.status,
             created_at: s.createdAt
         }));
         return res.json({ success: true, data });
      }

      if (type === 'feeders') {
         const feeders = await feederRepo.list();
         const substations = await substationRepo.list();
         const subMap = new Map(substations.map(s => [String(s.id), s]));
         
         const data = feeders.map(f => {
             const sub = subMap.get(String(f.substation_id));
             return {
                 id: f.id,
                 feeder_code: f.feeder_code,
                 name: f.name,
                 substation_code: sub?.substation_code || null,
                 substation_name: sub?.name || null,
                 voltage_level: f.voltage_level,
                 start_point: f.start_point,
                 end_point: f.end_point,
                 status: f.status,
                 created_at: f.createdAt
             };
         });
         return res.json({ success: true, data });
      }
    }

    let query = '';
    let params: any[] = [];
    let whereClauses: string[] = [];

    switch (type) {
      case 'devices':
        query = `
          SELECT d.id, d.device_id, d.device_code, d.name, d.device_type, d.pole_number,
                 f.feeder_code, f.name as feeder_name, s.substation_code, s.name as substation_name,
                 d.unit, d.team, d.status, d.latitude, d.longitude, d.notes, d.created_at
          FROM devices d
          LEFT JOIN feeders f ON d.feeder_id = f.id
          LEFT JOIN substations s ON f.substation_id = s.id
          WHERE d.deleted_at IS NULL`;
        
        if (team) {
          whereClauses.push(`d.team = ?`);
          params.push(team);
        }
        if (substation) {
          whereClauses.push(`s.substation_code = ?`);
          params.push(substation);
        }
        if (feeder) {
          whereClauses.push(`f.feeder_code = ?`);
          params.push(feeder);
        }
        if (device_type) {
          const dbType = device_type.toString().toUpperCase() === 'REC' ? 'RCL' : device_type;
          whereClauses.push(`d.device_type = ?`);
          params.push(dbType);
        }
        if (status) {
          whereClauses.push(`d.status = ?`);
          params.push(status);
        }
        if (fromDate) {
          whereClauses.push(`d.created_at >= ?`);
          params.push(fromDate);
        }
        if (toDate) {
          whereClauses.push(`d.created_at <= ?`);
          params.push(toDate + ' 23:59:59');
        }

        if (whereClauses.length > 0) {
          query += ` AND ` + whereClauses.join(' AND ');
        }
        query += ` ORDER BY d.device_id ASC`;
        break;

      case 'device_status':
        query = `
          SELECT d.status, COUNT(*) as total_count,
                 SUM(CASE WHEN d.device_type = 'LBS' THEN 1 ELSE 0 END) as total_lbs,
                 SUM(CASE WHEN d.device_type IN ('RCL', 'REC') THEN 1 ELSE 0 END) as total_rcl,
                 SUM(CASE WHEN d.device_type = 'DS' THEN 1 ELSE 0 END) as total_ds,
                 SUM(CASE WHEN d.device_type = 'RMU' THEN 1 ELSE 0 END) as total_rmu
          FROM devices d
          WHERE d.deleted_at IS NULL
          GROUP BY d.status
          ORDER BY total_count DESC`;
        break;

      case 'substations':
        query = `
          SELECT id, substation_code, name, address, latitude, longitude, status, created_at
          FROM substations
          WHERE deleted_at IS NULL`;
        if (status) {
          query += ` AND status = ?`;
          params.push(status);
        }
        query += ` ORDER BY substation_code ASC`;
        break;

      case 'feeders':
        query = `
          SELECT f.id, f.feeder_code, f.name, s.substation_code, s.name as substation_name,
                 f.start_point, f.end_point, f.status, f.created_at
          FROM feeders f
          LEFT JOIN substations s ON f.substation_id = s.id
          WHERE f.deleted_at IS NULL`;
        if (substation) {
          query += ` AND s.substation_code = ?`;
          params.push(substation);
        }
        if (status) {
          query += ` AND f.status = ?`;
          params.push(status);
        }
        query += ` ORDER BY f.feeder_code ASC`;
        break;

      case 'loops':
        query = `
          SELECT l.id, l.loop_code as loop_id, l.name,
                 s1.substation_code as substation_a_code, s1.name as substation_a_name,
                 f1.feeder_code as feeder_a_code,
                 s2.substation_code as substation_b_code, s2.name as substation_b_name,
                 f2.feeder_code as feeder_b_code,
                 l.scada_status, l.relay_79_status, l.approval_status, l.version, l.created_at
          FROM loops l
          LEFT JOIN substations s1 ON l.substation_a_id = s1.id
          LEFT JOIN feeders f1 ON l.feeder_a_id = f1.id
          LEFT JOIN substations s2 ON l.substation_b_id = s2.id
          LEFT JOIN feeders f2 ON l.feeder_b_id = f2.id
          ORDER BY l.loop_code ASC`;
        break;

      case 'tasks':
        query = `
          SELECT t.id, t.task_code, t.title, t.priority, t.status, t.team,
                 u.full_name as assigned_to, d.device_id as device_code, t.due_date, t.created_at
          FROM tasks t
          LEFT JOIN users u ON t.assigned_to_user_id = u.id
          LEFT JOIN devices d ON t.device_id = d.id
          WHERE 1=1`;
        if (team) {
          query += ` AND t.team = ?`;
          params.push(team);
        }
        if (status) {
          query += ` AND t.status = ?`;
          params.push(status);
        }
        if (fromDate) {
          query += ` AND t.created_at >= ?`;
          params.push(fromDate);
        }
        if (toDate) {
          query += ` AND t.created_at <= ?`;
          params.push(toDate + ' 23:59:59');
        }
        query += ` ORDER BY t.created_at DESC`;
        break;

      case 'proposals':
        query = `
          SELECT p.id, p.proposal_code, p.title, p.proposal_type, p.device_id, p.device_code,
                 p.requester_name, p.requester_team, p.status, p.created_at, p.reviewed_at
          FROM device_proposals p
          WHERE 1=1`;
        if (team) {
          query += ` AND p.requester_team = ?`;
          params.push(team);
        }
        if (status) {
          query += ` AND p.status = ?`;
          params.push(status);
        }
        if (fromDate) {
          query += ` AND p.created_at >= ?`;
          params.push(fromDate);
        }
        if (toDate) {
          query += ` AND p.created_at <= ?`;
          params.push(toDate + ' 23:59:59');
        }
        query += ` ORDER BY p.created_at DESC`;
        break;

      case 'checklists':
        query = `
          SELECT id, checklist_code, title, category, target_device_type, version, created_at
          FROM checklists
          ORDER BY checklist_code ASC`;
        break;

      case 'issues':
        query = `
          SELECT i.id, i.issue_code, i.title, i.severity, i.status, d.device_id as device_code,
                 u1.full_name as reported_by, u2.full_name as assigned_to, i.reported_at
          FROM issues i
          LEFT JOIN devices d ON i.device_id = d.id
          LEFT JOIN users u1 ON i.reported_by_user_id = u1.id
          LEFT JOIN users u2 ON i.assigned_to_user_id = u2.id
          ORDER BY i.reported_at DESC`;
        break;

      case 'audit':
        query = `
          SELECT id, username, user_fullname, action, module, target_id, details, result, ip_address, created_at
          FROM audit_logs
          ORDER BY created_at DESC
          LIMIT 500`;
        break;

      default:
        return res.status(400).json({ success: false, message: 'Loại báo cáo không hợp lệ' });
    }

    const rawData = dbQuery(query, params);
    const data = type === 'devices' ? rawData.map((d: any) => ({
      ...d,
      device_type: d.device_type === 'RCL' ? 'REC' : d.device_type
    })) : rawData;

    return res.json({
      success: true,
      type,
      total: data.length,
      data
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 2. GET /api/reports/loop-topology/:id - Detail Ring Loop Topology Report structure for PDF/Print
router.get('/loop-topology/:id', (req: AuthenticatedRequest, res) => {
  const userPermissions = req.user?.permissions || [];
  const userRoles = req.user?.roles || [];
  if (!userPermissions.includes('reports:read') && !userRoles.includes('ADMIN')) {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền xem báo cáo sơ đồ vòng' });
  }

  const loopId = parseInt(req.params.id, 10);

  const loop = dbQueryOne(
    `SELECT l.id, l.loop_code as loop_id, l.name, l.status, l.scada_status, l.relay_79_status,
            l.approval_status, l.version, l.approved_by, l.approved_at, l.created_at,
            s1.substation_code as station_a_code, s1.name as station_a_name, s1.address as station_a_addr,
            f1.feeder_code as feeder_a_code, f1.name as feeder_a_name,
            d1.device_id as device_a_code, d1.name as device_a_name, d1.pole_number as device_a_pole,
            s2.substation_code as station_b_code, s2.name as station_b_name, s2.address as station_b_addr,
            f2.feeder_code as feeder_b_code, f2.name as feeder_b_name,
            d2.device_id as device_b_code, d2.name as device_b_name, d2.pole_number as device_b_pole
     FROM loops l
     LEFT JOIN substations s1 ON l.substation_a_id = s1.id
     LEFT JOIN feeders f1 ON l.feeder_a_id = f1.id
     LEFT JOIN devices d1 ON l.tie_device_a_id = d1.id
     LEFT JOIN substations s2 ON l.substation_b_id = s2.id
     LEFT JOIN feeders f2 ON l.feeder_b_id = f2.id
     LEFT JOIN devices d2 ON l.tie_device_b_id = d2.id
     WHERE l.id = ?`,
    [loopId]
  );

  if (!loop) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin mạch khép vòng' });
  }

  const topologyPipeline = {
    station_a: { code: loop.station_a_code, name: loop.station_a_name, address: loop.station_a_addr },
    feeder_a: { code: loop.feeder_a_code, name: loop.feeder_a_name },
    tie_device_a: { code: loop.device_a_code, name: loop.device_a_name, pole: loop.device_a_pole },
    loop_point: {
      loop_code: loop.loop_id,
      loop_name: loop.name,
      status: loop.status,
      scada_status: loop.scada_status,
      relay_79: loop.relay_79_status
    },
    tie_device_b: { code: loop.device_b_code, name: loop.device_b_name, pole: loop.device_b_pole },
    feeder_b: { code: loop.feeder_b_code, name: loop.feeder_b_name },
    station_b: { code: loop.station_b_code, name: loop.station_b_name, address: loop.station_b_addr }
  };

  return res.json({
    success: true,
    data: {
      loop,
      topologyPipeline,
      meta: {
        exported_by: req.user!.full_name,
        exported_at: new Date().toISOString(),
        version: loop.version || '1.0'
      }
    }
  });
});

export default router;
