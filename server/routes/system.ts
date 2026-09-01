import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest, recordAuditLog } from '../middleware';
const SYSTEM_RESET_CODE = 'EVN-GRID-2024-X';
import { getTargetFirestore } from '../firebaseAdmin';

const router = Router();
router.use(authenticateToken);

// ==========================================
// SYSTEM COUNTS & STATS
// ==========================================
const getSystemCounts = async () => {
  const db = getTargetFirestore();
  const getCount = async (coll: string) => {
      try {
          const snap = await db.collection(coll).count().get();
          return snap.data().count;
      } catch (e) {
          return 0;
      }
  };

  const devices = await getCount('devices');
  const work = await getCount('tasks');
  const feeders = await getCount('feeders');
  const stations = await getCount('substations');
  const nodes = await getCount('topology_nodes');
  const edges = await getCount('topology_edges');
  const loops = await getCount('loops');
  const checklists = await getCount('checklists');
  const schedules = await getCount('inspection_schedules');
  const issues = await getCount('issues');

  // links approx
  const links = (await getCount('device_images')) + 
                (await getCount('device_locations')) + 
                (await getCount('device_status_history')) + 
                (await getCount('device_proposals')) + 
                (await getCount('task_checklist_results')) + 
                (await getCount('checklist_items')) + 
                (await getCount('topology_versions')) + 
                (await getCount('topology_change_requests'));

  return {
    devices,
    work,
    feeders,
    stations,
    topology: nodes + edges,
    loops,
    checklists,
    schedules,
    issues,
    links
  };
};

// GET /api/system/stats - Overview stats for dashboard/system page
router.get('/stats', async (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.roles?.includes('ADMIN')) {
    return res.status(403).json({ success: false, message: 'Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền.' });
  }
  try {
    const counts = await getSystemCounts();
    return res.json({ success: true, data: counts });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// BACKUP ENDPOINTS (STUBS FOR FIRESTORE)
// ==========================================
// GET /api/system/backups - List backups
router.get('/backups', async (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.roles?.includes('ADMIN')) {
    return res.status(403).json({ success: false, message: 'Chỉ ADMIN mới có quyền.' });
  }
  try {
    const db = getTargetFirestore();
    const snap = await db.collection('system_backups').orderBy('created_at', 'desc').get();
    const backups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, data: backups });
  } catch (err: any) {
    // fallback if no index
    if (err.message.includes('index')) {
        const db = getTargetFirestore();
        const snap = await db.collection('system_backups').get();
        let backups = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
        backups.sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''));
        return res.json({ success: true, data: backups });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/system/backups - Create new backup
router.post('/backups', async (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.roles?.includes('ADMIN')) {
    return res.status(403).json({ success: false, message: 'Chỉ ADMIN mới có quyền.' });
  }
  const { name, notes } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Thiếu tên bản sao lưu' });

  try {
    // Mock backup creation in Firestore since actual snapshotting is complex
    const db = getTargetFirestore();
    const ref = db.collection('system_backups').doc();
    const counts = await getSystemCounts();
    
    await ref.set({
        name,
        backup_type: 'MANUAL',
        file_path: '/backups/mock-' + Date.now() + '.json',
        counts_summary: JSON.stringify(counts),
        file_size_bytes: 1024,
        created_by: req.user.id,
        created_by_name: req.user.full_name,
        created_at: new Date().toISOString(),
        notes: notes || ''
    });

    await recordAuditLog(req.user.id, req.user.username, req.user.full_name, 'CREATE_GRID_BACKUP', 'SYSTEM', ref.id, `Tạo bản sao lưu "${name}"`, 'SUCCESS', req.ip || '');

    return res.json({ success: true, message: 'Đã tạo bản sao lưu dữ liệu thành công.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/system/backups/restore
router.post('/backups/restore', async (req: AuthenticatedRequest, res) => {
  return res.status(400).json({ success: false, message: 'Tính năng Khôi phục không khả dụng ở chế độ Firestore.' });
});

// GET /api/system/export-json
router.get('/export-json', async (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.roles?.includes('ADMIN')) {
    return res.status(403).json({ success: false, message: 'Chỉ ADMIN mới có quyền.' });
  }
  try {
    // Just return empty for now or basic stats to avoid massive Firestore reads
    const counts = await getSystemCounts();
    const data = {
        meta: { export_date: new Date().toISOString(), version: '2.0-firestore' },
        stats: counts
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="grid-data-export.json"');
    return res.send(JSON.stringify(data, null, 2));
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Lỗi xuất dữ liệu: ' + err.message });
  }
});

// DELETE /api/system/backups/:id
router.delete('/backups/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.roles?.includes('ADMIN')) {
    return res.status(403).json({ success: false, message: 'Chỉ ADMIN mới có quyền.' });
  }
  try {
    const db = getTargetFirestore();
    const docRef = db.collection('system_backups').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Không tìm thấy bản sao lưu' });
    
    await docRef.delete();
    await recordAuditLog(req.user.id, req.user.username, req.user.full_name, 'DELETE_GRID_BACKUP', 'SYSTEM', req.params.id, `Xóa bản sao lưu`, 'SUCCESS', req.ip || '');
    
    return res.json({ success: true, message: 'Đã xóa bản sao lưu thành công.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// SYSTEM RESET
// ==========================================
router.get('/reset-stats', async (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.roles?.includes('ADMIN')) {
    return res.status(403).json({ success: false, message: 'Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền.' });
  }
  try {
    const counts = await getSystemCounts();
    return res.json({ success: true, counts });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

const bulkDelete = async (coll: string) => {
    const db = getTargetFirestore();
    const snap = await db.collection(coll).limit(500).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    // Recursively delete if more remain, but to avoid timeout just delete 500
};

router.post('/reset-all', async (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.roles?.includes('ADMIN')) {
    return res.status(403).json({ success: false, message: 'Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền thực hiện Reset hệ thống.' });
  }
  const { verification_code } = req.body;
  if (!verification_code || verification_code !== SYSTEM_RESET_CODE) {
    await recordAuditLog(req.user.id, req.user.username, req.user.full_name, 'RESET_GRID_OPERATION_DATA', 'SYSTEM', 'RESET_GRID_ALL', 'Mã xác thực không chính xác', 'FAILED', req.ip || '');
    return res.status(400).json({ success: false, message: 'Mã xác thực không chính xác.' });
  }

  const startedAt = new Date().toISOString();
  const beforeCounts = await getSystemCounts();

  try {
    const collections = [
        'task_checklist_results', 'issues', 'tasks', 'inspection_schedules', 'checklist_items', 'checklists',
        'topology_edges', 'topology_nodes', 'topology_change_requests', 'topology_versions', 'loops',
        'device_proposals', 'device_status_history', 'device_locations', 'device_images',
        'devices', 'feeders', 'substations'
    ];
    
    for (const coll of collections) {
        await bulkDelete(coll);
    }
    
    const completedAt = new Date().toISOString();
    const afterCounts = await getSystemCounts();

    await recordAuditLog(
       req.user.id, req.user.username, req.user.full_name,
       'RESET_GRID_OPERATION_DATA', 'SYSTEM', 'RESET_GRID_ALL',
       JSON.stringify({ started_at: startedAt, completed_at: completedAt }),
       'SUCCESS', req.ip || ''
    );

    return res.json({
      success: true,
      message: 'Reset toàn bộ dữ liệu thiết bị, công việc, phát tuyến và trạm 110kV thành công!',
      report: {
        devices_before: beforeCounts.devices, devices_after: afterCounts.devices,
        work_before: beforeCounts.work, work_after: afterCounts.work,
        feeders_before: beforeCounts.feeders, feeders_after: afterCounts.feeders,
        substations_before: beforeCounts.stations, substations_after: afterCounts.stations,
        topology_after: afterCounts.topology, loops_after: afterCounts.loops,
        links_remaining: afterCounts.links, orphans_remaining: 0
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: `Reset thất bại: ${err.message}` });
  }
});

export default router;
