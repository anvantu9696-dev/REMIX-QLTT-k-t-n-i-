import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware';
import { getTargetFirestore } from '../firebaseAdmin';
import { deviceRepo } from '../repositories/firestore/deviceRepository';
import { substationRepo } from '../repositories/firestore/substationRepository';
import { feederRepo } from '../repositories/firestore/feederRepository';
import { loopRepo } from '../repositories/firestore/loopRepository';

const router = Router();
router.use(authenticateToken);

router.get('/data', async (req: AuthenticatedRequest, res) => {
  const { type = 'devices', fromDate, toDate, team, substation, feeder, device_type, status } = req.query;
  try {
    const userPermissions: string[] = [];
    const userRoles = req.user?.roles || [];
    const isPrivileged = userRoles.some(r => ['ADMIN', 'CAN_BO_PHUONG_THUC', 'TRUONG_CA', 'DOI_TRUONG', 'QUAN_LY', 'LÃNH ĐẠO', 'PHO_CA', 'NHAN_VIEN_VAN_HANH', 'FIELD_OPERATOR'].includes(r));
    
    if (!userPermissions.includes('reports:read') && !userRoles.includes('ADMIN') && !isPrivileged && userPermissions.length > 0) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem báo cáo' });
    }

    const db = getTargetFirestore();

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
               device_id: d.id,
               device_code: d.name,
               name: d.name,
               device_type: d.device_type === 'RCL' ? 'REC' : d.device_type,
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
       
       return res.json({ success: true, type, total: filteredDevices.length, data: filteredDevices });
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
       const data = Object.keys(statusMap).map(st => ({ status: st, ...statusMap[st] })).sort((a,b) => b.total_count - a.total_count);
       return res.json({ success: true, type, total: data.length, data });
    }

    if (type === 'substations') {
       let items = await substationRepo.list();
       if (status) items = items.filter(s => s.status === status);
       items.sort((a,b) => a.substation_code.localeCompare(b.substation_code));
       return res.json({ success: true, type, total: items.length, data: items });
    }

    if (type === 'feeders') {
       let items = await feederRepo.list();
       const subs = await substationRepo.list();
       const subMap = new Map(subs.map(s => [String(s.id), s.name]));
       
       let filtered = items.map(f => ({
           ...f,
           substation_name: subMap.get(String(f.substation_id)) || null
       }));
       if (substation) filtered = filtered.filter(f => (f as any).substation_code === substation);
       if (status) filtered = filtered.filter(f => f.status === status);
       filtered.sort((a,b) => a.feeder_code.localeCompare(b.feeder_code));
       return res.json({ success: true, type, total: filtered.length, data: filtered });
    }

    if (type === 'loops') {
       let items = await loopRepo.list();
       items.sort((a,b) => (a as any).loop_code.localeCompare((b as any).loop_code));
       return res.json({ success: true, type, total: items.length, data: items });
    }

    // Generic collection querying
    let collName = '';
    if (type === 'tasks') collName = 'tasks';
    else if (type === 'proposals') collName = 'device_proposals';
    else if (type === 'checklists') collName = 'checklists';
    else if (type === 'issues') collName = 'issues';
    else if (type === 'audit') collName = 'audit_logs';
    else return res.status(400).json({ success: false, message: 'Loại báo cáo không hợp lệ' });

    let query: any = db.collection(collName).where('isDeleted', '==', false);
    
    // For audit we don't have isDeleted and need limit
    if (collName === 'audit_logs') {
        query = db.collection('audit_logs').orderBy('createdAt', 'desc').limit(500);
    } else {
        if (team && (collName === 'tasks' || collName === 'device_proposals')) {
            const teamField = collName === 'tasks' ? 'team' : 'requester_team';
            query = query.where(teamField, '==', team);
        }
        if (status) query = query.where('status', '==', status);
        query = query.orderBy('createdAt', 'desc');
    }

    const snap = await query.get();
    let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (fromDate || toDate) {
        data = data.filter(d => {
            if (!d.createdAt) return false;
            let pass = true;
            if (fromDate && d.createdAt < fromDate) pass = false;
            if (toDate && d.createdAt > (toDate + ' 23:59:59')) pass = false;
            return pass;
        });
    }

    return res.json({ success: true, type, total: data.length, data });
    
  } catch (error: any) {
    console.error('Error fetching reports:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/loop-topology/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const loopId = req.params.id;
    const loop = await loopRepo.getById(loopId);
    if (!loop) return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin mạch khép vòng' });
    
    return res.json({
      success: true,
      data: {
        loop,
        topologyPipeline: {
          loop_point: {
            loop_code: (loop as any).loop_code,
            loop_name: loop.name,
            status: loop.status
          }
        },
        meta: {
          exported_by: req.user!.full_name,
          exported_at: new Date().toISOString(),
          version: '1.0'
        }
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
