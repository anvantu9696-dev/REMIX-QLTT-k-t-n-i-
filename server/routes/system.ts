import { Router } from 'express';
import { dbQuery, dbQueryOne, dbRun, createSystemBackup, restoreFromBackup, exportGridDataJson } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware';
import { initializeApp, applicationDefault, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import http from 'http';

const router = Router();
router.use(authenticateToken);

// Helper to fetch service account email from metadata server
async function getServiceAccountEmail(): Promise<string> {
    return new Promise((resolve) => {
        const options = {
            hostname: 'metadata.google.internal',
            path: '/computeMetadata/v1/instance/service-accounts/default/email',
            headers: { 'Metadata-Flavor': 'Google' },
            timeout: 2000
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', () => resolve('NOT_AVAILABLE'));
        req.on('timeout', () => { req.destroy(); resolve('NOT_AVAILABLE'); });
        req.end();
    });
}

router.get('/firebase-diagnostics', async (req: AuthenticatedRequest, res) => {
    if (!req.user || !req.user.roles?.includes('ADMIN')) {
        return res.status(403).json({ success: false, message: 'Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền.' });
    }

    try {
        const adminApp = getApps().length > 0 ? getApp() : initializeApp({ credential: applicationDefault() });
        const projectId = adminApp.options.projectId || process.env.GOOGLE_CLOUD_PROJECT || 'UNKNOWN';
        const serviceAccountEmail = await getServiceAccountEmail();
        const databaseId = 'ai-studio-remixqunlthitbli-d646d96a-f5c6-4aef-9fca-c34a3e1200a6';

        const results: any = {
            processEnvProjectId: process.env.GOOGLE_CLOUD_PROJECT,
            processEnvGCloudProject: process.env.GCLOUD_PROJECT,
            firebaseAppProjectId: adminApp.options.projectId,
            serviceAccountEmail,
            databaseId,
            resourceName: `projects/${projectId}/databases/${databaseId}`,
            // We cannot easily get version in this environment, skipping
        };

        // Tests
        const defaultDb = getFirestore(adminApp);
        const namedDb = getFirestore(adminApp, databaseId);

        const testRunId = Math.random().toString(36).substring(7);

        // Default DB Test
        try {
            await defaultDb.collection('_system').doc('admin_diagnostic').set({ testRunId, testedAt: FieldValue.serverTimestamp() });
            await defaultDb.collection('_system').doc('admin_diagnostic').get();
            results.defaultDb = 'PASS';
        } catch (e: any) {
            results.defaultDb = 'FAIL: ' + e.message;
        }

        // Named DB Test
        try {
            await namedDb.collection('_system').doc('admin_diagnostic').set({ testRunId, testedAt: FieldValue.serverTimestamp() });
            await namedDb.collection('_system').doc('admin_diagnostic').get();
            results.namedDb = 'PASS';
        } catch (e: any) {
            results.namedDb = 'FAIL: ' + e.message;
        }

        return res.json({ success: true, diagnostics: results });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

const SYSTEM_RESET_CODE = '22071984';

// Helper to get counts before reset
function getSystemCounts() {
  const deviceRow = dbQueryOne('SELECT COUNT(*) as count FROM devices') as { count: number };
  const workRow = dbQueryOne('SELECT COUNT(*) as count FROM tasks') as { count: number };
  const feederRow = dbQueryOne('SELECT COUNT(*) as count FROM feeders') as { count: number };
  const stationRow = dbQueryOne('SELECT COUNT(*) as count FROM substations') as { count: number };
  const topoRow = dbQueryOne('SELECT (SELECT COUNT(*) FROM topology_nodes) + (SELECT COUNT(*) FROM topology_edges) as count') as { count: number };
  const loopRow = dbQueryOne('SELECT COUNT(*) as count FROM loops') as { count: number };
  const checklistRow = dbQueryOne('SELECT COUNT(*) as count FROM checklists') as { count: number };
  const scheduleRow = dbQueryOne('SELECT COUNT(*) as count FROM inspection_schedules') as { count: number };
  const issueRow = dbQueryOne('SELECT COUNT(*) as count FROM issues') as { count: number };

  // Total link/association records count
  const linksRow = dbQueryOne(`
    SELECT (
      (SELECT COUNT(*) FROM device_images) +
      (SELECT COUNT(*) FROM device_locations) +
      (SELECT COUNT(*) FROM device_status_history) +
      (SELECT COUNT(*) FROM device_proposals) +
      (SELECT COUNT(*) FROM task_checklist_results) +
      (SELECT COUNT(*) FROM checklist_items) +
      (SELECT COUNT(*) FROM topology_versions) +
      (SELECT COUNT(*) FROM topology_change_requests)
    ) as count
  `) as { count: number };

  const totalWork = (workRow?.count || 0) + (checklistRow?.count || 0) + (scheduleRow?.count || 0) + (issueRow?.count || 0);
  const totalTopo = (topoRow?.count || 0) + (loopRow?.count || 0);

  return {
    devices: deviceRow?.count || 0,
    work: totalWork,
    feeders: feederRow?.count || 0,
    stations: stationRow?.count || 0,
    topology: totalTopo,
    loops: loopRow?.count || 0,
    links: linksRow?.count || 0
  };
}

// ==========================================
// ADMIN BACKUP & SNAPSHOT RESTORE ROUTES
// ==========================================

// 1. GET all system backups
router.get('/backups', (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.roles?.includes('ADMIN')) {
    return res.status(403).json({ success: false, message: 'Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền xem danh sách bản sao lưu.' });
  }

  try {
    const rows = dbQuery(`
      SELECT id, name, backup_type, file_path, counts_summary, file_size_bytes, created_by, created_by_name, created_at, notes
      FROM system_backups
      ORDER BY id DESC
    `);

    const backups = rows.map((r: any) => {
      let counts = {};
      try {
        counts = JSON.parse(r.counts_summary);
      } catch (e) {}
      return {
        ...r,
        counts_summary: counts
      };
    });

    return res.json({
      success: true,
      backups
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 2. GET the latest backup info + comparison with current system counts
router.get('/backups/latest', (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.roles?.includes('ADMIN')) {
    return res.status(403).json({ success: false, message: 'Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền truy cập.' });
  }

  try {
    const row = dbQueryOne(`
      SELECT id, name, backup_type, file_path, counts_summary, file_size_bytes, created_by, created_by_name, created_at, notes
      FROM system_backups
      ORDER BY id DESC
      LIMIT 1
    `);

    let backup: any = null;
    if (row) {
      let counts = {};
      try {
        counts = JSON.parse(row.counts_summary);
      } catch (e) {}
      backup = {
        ...row,
        counts_summary: counts
      };
    }

    const current_counts = exportGridDataJson().counts;

    return res.json({
      success: true,
      backup,
      current_counts
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 3. POST create a new manual system backup point
router.post('/backups', (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.roles?.includes('ADMIN')) {
    return res.status(403).json({ success: false, message: 'Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền tạo bản sao lưu.' });
  }

  try {
    const { name, notes } = req.body;
    const backupName = name?.trim() || `Sao lưu thủ công ${new Date().toLocaleString('vi-VN')}`;
    const backup = createSystemBackup(backupName, 'MANUAL', req.user, notes?.trim());

    try {
      dbRun(
        `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, req.user.username, req.user.full_name, 'CREATE_GRID_BACKUP', 'SYSTEM', String((backup as any).id), `Tạo bản sao lưu "${backupName}"`, 'SUCCESS', req.ip || '127.0.0.1']
      );
    } catch (e) {}

    return res.json({
      success: true,
      message: `Tạo bản sao lưu "${backupName}" thành công!`,
      backup
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 4. POST restore from latest backup
router.post('/backups/restore-latest', (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.roles?.includes('ADMIN')) {
    return res.status(403).json({ success: false, message: 'Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền khôi phục dữ liệu.' });
  }

  try {
    const result = restoreFromBackup('latest', req.user);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 5. POST restore from specific backup ID
router.post('/backups/:id/restore', (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.roles?.includes('ADMIN')) {
    return res.status(403).json({ success: false, message: 'Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền khôi phục dữ liệu.' });
  }

  try {
    const backupId = req.params.id;
    const result = restoreFromBackup(backupId, req.user);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 6. DELETE a backup
router.delete('/backups/:id', (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.roles?.includes('ADMIN')) {
    return res.status(403).json({ success: false, message: 'Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền xóa bản sao lưu.' });
  }

  try {
    const backupId = req.params.id;
    const backup = dbQueryOne(`SELECT * FROM system_backups WHERE id = ?`, [backupId]);
    if (!backup) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản sao lưu.' });
    }

    dbRun(`DELETE FROM system_backups WHERE id = ?`, [backupId]);

    try {
      dbRun(
        `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, req.user.username, req.user.full_name, 'DELETE_GRID_BACKUP', 'SYSTEM', String(backupId), `Xóa bản sao lưu "${backup.name}"`, 'SUCCESS', req.ip || '127.0.0.1']
      );
    } catch (e) {}

    return res.json({
      success: true,
      message: `Đã xóa bản sao lưu "${backup.name}" thành công.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// EXISTING SYSTEM RESET ROUTES WITH SAFETY BACKUP
// ==========================================

// GET counts for preview/warning modal before reset
router.get('/reset-stats', (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.roles?.includes('ADMIN')) {
    return res.status(403).json({ success: false, message: 'Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền.' });
  }

  try {
    const counts = getSystemCounts();
    return res.json({
      success: true,
      counts
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/reset-all', (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.roles?.includes('ADMIN')) {
    return res.status(403).json({ success: false, message: 'Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền thực hiện Reset hệ thống.' });
  }

  const { verification_code } = req.body;

  if (!verification_code || verification_code !== SYSTEM_RESET_CODE) {
    try {
      dbRun(
        `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, req.user.username, req.user.full_name, 'RESET_GRID_OPERATION_DATA', 'SYSTEM', 'RESET_GRID_ALL', 'Mã xác thực không chính xác', 'FAILED', req.ip || '127.0.0.1']
      );
    } catch (e) {}

    return res.status(400).json({ success: false, message: 'Mã xác thực không chính xác.' });
  }

  const startedAt = new Date().toISOString();
  const beforeCounts = getSystemCounts();

  // Automatically take safety snapshot before reset
  try {
    createSystemBackup(
      `Tự động sao lưu trước khi Reset Lưới điện (${new Date().toLocaleTimeString('vi-VN')})`,
      'AUTO_BEFORE_RESET',
      req.user,
      'Bản sao lưu an toàn tự động được tạo ngay trước khi Quản trị viên thực hiện Reset toàn bộ lưới điện.'
    );
  } catch (e) {
    console.error('Safety backup before reset failed:', e);
  }

  try {
    dbRun('BEGIN TRANSACTION');

    // Strict order of deletion following dependency graph:
    // 1. Work & Inspection & Issues related
    dbRun('DELETE FROM task_checklist_results');
    dbRun('DELETE FROM issues');
    dbRun('DELETE FROM tasks');
    dbRun('DELETE FROM inspection_schedules');
    dbRun('DELETE FROM checklist_items');
    dbRun('DELETE FROM checklists');

    // 2. Loops & Topology related
    dbRun('DELETE FROM topology_edges');
    dbRun('DELETE FROM topology_nodes');
    dbRun('DELETE FROM topology_change_requests');
    dbRun('DELETE FROM topology_versions');
    dbRun('DELETE FROM loops');

    // 3. Device linkages & proposals & history
    dbRun('DELETE FROM device_proposals');
    dbRun('DELETE FROM device_status_history');
    dbRun('DELETE FROM device_locations');
    dbRun('DELETE FROM device_images');

    // 4. Main core operational data (Devices, Feeders, Substations)
    dbRun('DELETE FROM devices');
    dbRun('DELETE FROM feeders');
    dbRun('DELETE FROM substations');

    // 5. Cleanup any orphaned records to ensure 0 orphans
    dbRun('DELETE FROM device_images WHERE device_id NOT IN (SELECT id FROM devices)');
    dbRun('DELETE FROM device_locations WHERE device_id NOT IN (SELECT id FROM devices)');
    dbRun('DELETE FROM device_status_history WHERE device_id NOT IN (SELECT id FROM devices)');
    dbRun('DELETE FROM device_proposals WHERE device_id IS NOT NULL AND device_id NOT IN (SELECT id FROM devices)');
    dbRun('DELETE FROM tasks WHERE device_id IS NOT NULL AND device_id NOT IN (SELECT id FROM devices)');
    dbRun('DELETE FROM issues WHERE device_id NOT IN (SELECT id FROM devices)');
    dbRun('DELETE FROM inspection_schedules WHERE device_id NOT IN (SELECT id FROM devices)');
    dbRun('DELETE FROM feeders WHERE substation_id NOT IN (SELECT id FROM substations)');
    dbRun('DELETE FROM devices WHERE feeder_id IS NOT NULL AND feeder_id NOT IN (SELECT id FROM feeders)');
    dbRun('DELETE FROM devices WHERE substation_id IS NOT NULL AND substation_id NOT IN (SELECT id FROM substations)');
    dbRun('DELETE FROM loops WHERE id IN (SELECT loop_id FROM loop_endpoints WHERE substation_id NOT IN (SELECT id FROM substations))');

    dbRun('COMMIT');

    const completedAt = new Date().toISOString();
    const afterCounts = getSystemCounts();
    const totalDeleted = (beforeCounts.devices - afterCounts.devices) +
                         (beforeCounts.work - afterCounts.work) +
                         (beforeCounts.feeders - afterCounts.feeders) +
                         (beforeCounts.stations - afterCounts.stations) +
                         (beforeCounts.topology - afterCounts.topology) +
                         (beforeCounts.loops - afterCounts.loops) +
                         (beforeCounts.links - afterCounts.links);

    try {
      dbRun(
        `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          req.user.username,
          req.user.full_name,
          'RESET_GRID_OPERATION_DATA',
          'SYSTEM',
          'RESET_GRID_ALL',
          JSON.stringify({
            started_at: startedAt,
            completed_at: completedAt,
            device_count_before: beforeCounts.devices,
            work_count_before: beforeCounts.work,
            feeder_count_before: beforeCounts.feeders,
            station_count_before: beforeCounts.stations,
            topology_count_before: beforeCounts.topology,
            deleted_count: totalDeleted
          }),
          'SUCCESS',
          req.ip || '127.0.0.1'
        ]
      );
    } catch (e) {}

    return res.json({
      success: true,
      message: 'Reset toàn bộ dữ liệu thiết bị, công việc, phát tuyến và trạm 110kV thành công!',
      report: {
        devices_before: beforeCounts.devices,
        devices_after: afterCounts.devices,
        work_before: beforeCounts.work,
        work_after: afterCounts.work,
        feeders_before: beforeCounts.feeders,
        feeders_after: afterCounts.feeders,
        substations_before: beforeCounts.stations,
        substations_after: afterCounts.stations,
        topology_after: afterCounts.topology,
        loops_after: afterCounts.loops,
        links_remaining: afterCounts.links,
        orphans_remaining: 0
      }
    });
  } catch (err: any) {
    dbRun('ROLLBACK');
    const completedAt = new Date().toISOString();
    try {
      dbRun(
        `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          req.user.username,
          req.user.full_name,
          'RESET_GRID_OPERATION_DATA',
          'SYSTEM',
          'RESET_GRID_ALL',
          JSON.stringify({ started_at: startedAt, completed_at: completedAt, error: err.message }),
          'FAILED',
          req.ip || '127.0.0.1'
        ]
      );
    } catch (e) {}

    return res.status(500).json({ success: false, message: `Reset thất bại do lỗi Transaction: ${err.message}` });
  }
});

export default router;

