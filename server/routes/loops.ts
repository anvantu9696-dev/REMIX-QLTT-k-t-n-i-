import { Router } from 'express';
import { CORE_DATA_SOURCE } from '../config';
import { getTargetFirestore } from '../firebaseAdmin';
import { loopRepo } from '../repositories/firestore/loopRepository';
import { topologyVersionRepo } from '../repositories/firestore/topologyVersionRepository';

import { dbQuery, dbQueryOne, dbRun, saveDb } from '../db';
import { authenticateToken, denyGuestMutations, requirePermission, requireAnyPermission, recordAuditLog, AuthenticatedRequest } from '../middleware';

const router = Router();

// GET /api/loops/reset-stats - Get count of all loop-related records before reset
router.get('/reset-stats', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const loopRow = dbQueryOne('SELECT COUNT(*) as count FROM loops WHERE deleted_at IS NULL') as { count: number };
    const allLoopRow = dbQueryOne('SELECT COUNT(*) as count FROM loops') as { count: number };
    const versionRow = dbQueryOne('SELECT COUNT(*) as count FROM topology_versions') as { count: number };
    const nodeRow = dbQueryOne('SELECT COUNT(*) as count FROM topology_nodes') as { count: number };
    const edgeRow = dbQueryOne('SELECT COUNT(*) as count FROM topology_edges') as { count: number };
    const changeReqRow = dbQueryOne('SELECT COUNT(*) as count FROM topology_change_requests') as { count: number };

    res.json({
      success: true,
      counts: {
        loops: allLoopRow?.count || 0,
        active_loops: loopRow?.count || 0,
        versions: versionRow?.count || 0,
        nodes: nodeRow?.count || 0,
        edges: edgeRow?.count || 0,
        change_requests: changeReqRow?.count || 0
      }
    });
  } catch (err: any) {
    console.error('Error fetching loop reset stats:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Helper handler for atomic loop reset
const handleResetLoops = (req: AuthenticatedRequest, res: any) => {
  try {
    // Check permission: Must be ADMIN or have equipment:delete
    const isAdmin = req.user?.roles?.includes('ADMIN') || (req.user as any)?.role === 'ADMIN';
    const hasDeletePerm = req.user?.permissions?.includes('equipment:delete') || req.user?.permissions?.includes('MANAGE_LOOPS');
    if (!isAdmin && !hasDeletePerm) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện Reset Khép vòng. Chức năng này yêu cầu quyền Quản trị viên (ADMIN).'
      });
    }

    const { confirmation } = req.body;
    const cleanConfirm = String(confirmation || '').trim().toUpperCase();

    // Verification string check: "XÓA KHÉP VÒNG" or "XOA KHEP VONG" or "XÓA TOÀN BỘ KHÉP VÒNG"
    if (cleanConfirm !== 'XÓA KHÉP VÒNG' && cleanConfirm !== 'XOA KHEP VONG' && cleanConfirm !== 'XÓA TOÀN BỘ KHÉP VÒNG') {
      return res.status(400).json({
        success: false,
        message: 'Chuỗi xác nhận không chính xác. Vui lòng nhập đúng "XÓA KHÉP VÒNG" để thực hiện.'
      });
    }

    const username = req.user?.username || 'ADMIN';
    const fullname = req.user?.full_name || username;

    // Snapshot counts before deletion
    const beforeLoops = (dbQueryOne('SELECT COUNT(*) as count FROM loops') as { count: number })?.count || 0;
    const beforeVersions = (dbQueryOne('SELECT COUNT(*) as count FROM topology_versions') as { count: number })?.count || 0;
    const beforeNodes = (dbQueryOne('SELECT COUNT(*) as count FROM topology_nodes') as { count: number })?.count || 0;
    const beforeEdges = (dbQueryOne('SELECT COUNT(*) as count FROM topology_edges') as { count: number })?.count || 0;
    const beforeReqs = (dbQueryOne('SELECT COUNT(*) as count FROM topology_change_requests') as { count: number })?.count || 0;

    // Run within atomic database transaction
    try {
      dbRun('BEGIN TRANSACTION;');

      // 1. Delete all topology change requests / loop approval requests
      dbRun('DELETE FROM topology_change_requests;');

      // 2. Delete all topology nodes & edges
      dbRun('DELETE FROM topology_nodes;');
      dbRun('DELETE FROM topology_edges;');

      // 3. Delete all topology versions
      dbRun('DELETE FROM topology_versions;');

      // 4. Delete all loops
      dbRun('DELETE FROM loops;');

      // 5. Clear loop_device_id reference if any on devices table to prevent orphan references
      try {
        dbRun("UPDATE devices SET notes = REPLACE(notes, 'Thiết bị Khép vòng chính', 'Thiết bị') WHERE device_id LIKE 'DEV-LBS-KV%'");
      } catch (e) {}

      // 6. Update system_settings flag so server restart will NEVER re-seed old loop data
      dbRun("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('phase3_seeded', '1', CURRENT_TIMESTAMP);");
      dbRun("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('loops_reset_at', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);");

      // 7. Audit log the reset action
      dbRun(
        `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
         VALUES (?, ?, ?, 'RESET_ALL_LOOP_CONNECTIONS', 'KHEP_VONG', 'ALL_LOOPS', ?, 'SUCCESS')`,
        [
          req.user?.id || 1,
          username,
          fullname,
          `Đã xóa toàn bộ ${beforeLoops} mạch khép vòng, ${beforeVersions} phiên bản topology, ${beforeNodes} nodes, ${beforeEdges} edges và ${beforeReqs} yêu cầu phê duyệt.`
        ]
      );

      dbRun('COMMIT;');

      // Persist changes to disk
      saveDb();

      return res.json({
        success: true,
        message: 'Đã xóa toàn bộ dữ liệu Khép vòng thành công. Hệ thống đã sẵn sàng để xây dựng lại mạch khép vòng từ đầu.',
        deleted_count: {
          loops: beforeLoops,
          versions: beforeVersions,
          nodes: beforeNodes,
          edges: beforeEdges,
          change_requests: beforeReqs
        },
        preserved: {
          substations: true,
          feeders: true,
          devices: true,
          users: true
        }
      });
    } catch (txErr: any) {
      try {
        dbRun('ROLLBACK;');
      } catch (rbErr) {}
      console.error('Transaction failed during loop reset:', txErr);
      return res.status(500).json({
        success: false,
        message: `Lỗi khi thực hiện xóa dữ liệu Khép vòng trong giao dịch: ${txErr.message}`
      });
    }
  } catch (err: any) {
    console.error('Error executing loop reset:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/loops/reset
router.post('/reset', authenticateToken, denyGuestMutations, handleResetLoops);

// POST /api/loops/reset-all
router.post('/reset-all', authenticateToken, denyGuestMutations, handleResetLoops);

// GET /api/loops - List all ring loops
router.get('/', authenticateToken, requireAnyPermission(['equipment:read', 'LOOP_VIEW']), async (req: AuthenticatedRequest, res) => {
  try {
    const { search, status, substation_id, feeder_id, sortBy, sortOrder } = req.query;

    if (CORE_DATA_SOURCE === 'firestore') {
        const { substationRepo } = require('../repositories/firestore/substationRepository');
        const { feederRepo } = require('../repositories/firestore/feederRepository');
        const { deviceRepo } = require('../repositories/firestore/deviceRepository');

        let loops = await loopRepo.list();
        if (status) {
            loops = loops.filter(l => l.status === status || l.operating_status === status || l.operation_status === status);
        }
        if (substation_id) {
            loops = loops.filter(l => String(l.substation_id_a) === String(substation_id) || String(l.substation_id_b) === String(substation_id));
        }
        if (feeder_id) {
            loops = loops.filter(l => String(l.feeder_id_a) === String(feeder_id) || String(l.feeder_id_b) === String(feeder_id));
        }
        
        const [subs, feeders, devices] = await Promise.all([
            substationRepo.list(),
            feederRepo.list(),
            deviceRepo.list()
        ]);

        const subMap = new Map(subs.map(s => [String(s.id), s]));
        const feedMap = new Map(feeders.map(f => [String(f.id), f]));
        const devMap = new Map(devices.map(d => [String(d.id), d]));
        const devMapByCode = new Map(devices.map(d => [String(d.device_code), d]));
        const devMapByIdStr = new Map(devices.map(d => [String(d.device_id), d]));

        function getDev(devId) {
            return devMap.get(String(devId)) || devMapByCode.get(String(devId)) || devMapByIdStr.get(String(devId));
        }

        const enrichedLoops = loops.map(l => {
            const subA: any = subMap.get(String(l.substation_id_a));
            const subB: any = subMap.get(String(l.substation_id_b));
            const feedA: any = feedMap.get(String(l.feeder_id_a));
            const feedB: any = feedMap.get(String(l.feeder_id_b));
            
            const devA: any = getDev(l.device_id_a);
            const devB: any = getDev(l.device_id_b);
            const devMain: any = getDev(l.loop_device_id);

            return {
                ...l,
                substation_name_a: subA?.name,
                substation_code_a: subA?.substation_code,
                feeder_name_a: feedA?.name,
                feeder_code_a: feedA?.feeder_code,
                device_name_a: devA?.name,
                device_code_a: devA?.device_code,
                device_type_a: devA?.device_type,
                switch_status_a: devA?.switch_status,
                
                substation_name_b: subB?.name,
                substation_code_b: subB?.substation_code,
                feeder_name_b: feedB?.name,
                feeder_code_b: feedB?.feeder_code,
                device_name_b: devB?.name,
                device_code_b: devB?.device_code,
                device_type_b: devB?.device_type,
                switch_status_b: devB?.switch_status,
                
                loop_device_name: devMain?.name,
                loop_device_code: devMain?.device_code,
                loop_device_type: devMain?.device_type,
                loop_device_switch_status: devMain?.switch_status,
                loop_device_status: devMain?.status,
                loop_device_pole: devMain?.pole_number,
                loop_device_unit: devMain?.unit,
                loop_device_team: devMain?.team,
                loop_device_latitude: devMain?.latitude,
                loop_device_longitude: devMain?.longitude,
            };
        });

        return res.json({ success: true, data: enrichedLoops });
    }

    let sql = `
      SELECT 
        l.*,
        sa.name as substation_name_a, sa.substation_code as substation_code_a,
        fa.name as feeder_name_a, fa.feeder_code as feeder_code_a,
        da.name as device_name_a, da.device_code as device_code_a, da.device_type as device_type_a, da.switch_status as switch_status_a,
        sb.name as substation_name_b, sb.substation_code as substation_code_b,
        fb.name as feeder_name_b, fb.feeder_code as feeder_code_b,
        db.name as device_name_b, db.device_code as device_code_b, db.device_type as device_type_b, db.switch_status as switch_status_b,
        dmain.name as loop_device_name, dmain.device_code as loop_device_code, dmain.device_type as loop_device_type,
        dmain.switch_status as loop_device_switch_status, dmain.status as loop_device_status,
        dmain.pole_number as loop_device_pole, dmain.unit as loop_device_unit, dmain.team as loop_device_team,
        dmain.latitude as loop_device_latitude, dmain.longitude as loop_device_longitude, dmain.google_maps_url as loop_device_maps_url,
        (SELECT image_url FROM device_images WHERE device_id = dmain.id AND is_primary = 1 LIMIT 1) as loop_device_image,
        (
          SELECT version FROM topology_versions 
          WHERE loop_id = l.id AND status IN ('PUBLISHED', 'APPROVED') 
          ORDER BY id DESC LIMIT 1
        ) as active_version,
        (
          SELECT status FROM topology_versions 
          WHERE loop_id = l.id AND status IN ('PUBLISHED', 'APPROVED') 
          ORDER BY id DESC LIMIT 1
        ) as active_version_status,
        (
          SELECT COUNT(*) FROM topology_nodes tn 
          JOIN topology_versions tv ON tn.version_id = tv.id 
          WHERE tv.loop_id = l.id AND tv.status IN ('PUBLISHED', 'APPROVED')
        ) as node_count,
        (
          SELECT COUNT(*) FROM topology_edges te 
          JOIN topology_versions tv ON te.version_id = tv.id 
          WHERE tv.loop_id = l.id AND tv.status IN ('PUBLISHED', 'APPROVED')
        ) as edge_count
      FROM loops l
      LEFT JOIN loop_endpoints ea ON l.id = ea.loop_id AND ea.endpoint_role = 'MAIN_SOURCE'
      LEFT JOIN substations sa ON ea.substation_id = sa.id
      LEFT JOIN feeders fa ON ea.feeder_id = fa.id
      LEFT JOIN devices da ON (ea.device_id = da.device_id OR ea.device_id = CAST(da.id AS TEXT))
      LEFT JOIN loop_endpoints eb ON l.id = eb.loop_id AND eb.endpoint_role = 'BACKUP_SOURCE'
      LEFT JOIN substations sb ON eb.substation_id = sb.id
      LEFT JOIN feeders fb ON eb.feeder_id = fb.id
      LEFT JOIN devices db ON (eb.device_id = db.device_id OR eb.device_id = CAST(db.id AS TEXT))
      LEFT JOIN devices dmain ON (l.loop_device_id = dmain.device_id OR l.loop_device_id = CAST(dmain.id AS TEXT))
      WHERE l.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (search) {
      sql += ` AND (l.loop_code LIKE ? OR l.name LIKE ? OR l.notes LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    
    // ... filters ...
    
    // Filters
    if (status) {
      sql += ` AND l.status = ?`;
      params.push(status);
    }

    if (substation_id) {
      sql += ` AND EXISTS (SELECT 1 FROM loop_endpoints e WHERE e.loop_id = l.id AND e.substation_id = ?)`;
      params.push(Number(substation_id));
    }

    if (feeder_id) {
      sql += ` AND EXISTS (SELECT 1 FROM loop_endpoints e WHERE e.loop_id = l.id AND e.feeder_id = ?)`;
      params.push(Number(feeder_id));
    }
    
    // Sorting
    const validSortColumns = ['name', 'loop_id', 'loop_code', 'status', 'node_count', 'edge_count']; 
    let sortByCol = 'l.id';
    if (sortBy === 'loop_id' || sortBy === 'loop_code') {
      sortByCol = 'l.loop_code';
    } else if (validSortColumns.includes(sortBy as string)) {
      sortByCol = `l.${sortBy}`;
    }
    const sortOrderVal = sortOrder?.toString().toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    sql += ` ORDER BY ${sortByCol} ${sortOrderVal}`;

    const loops = dbQuery(sql, params);

    res.json({ success: true, data: loops });
  } catch (err: any) {
    console.error('Error fetching loops:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/loops/:id - Get Loop Detail with active or specified version topology
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const versionIdParam = req.query.version_id;

    if (CORE_DATA_SOURCE === 'firestore') {
        const { substationRepo } = require('../repositories/firestore/substationRepository');
        const { feederRepo } = require('../repositories/firestore/feederRepository');
        const { deviceRepo } = require('../repositories/firestore/deviceRepository');

        const loop = await loopRepo.getById(id);
        if (!loop || loop.isDeleted) return res.status(404).json({ success: false, message: 'Khép vòng không tồn tại' });

        const [subs, feeders, devices] = await Promise.all([
            substationRepo.list(),
            feederRepo.list(),
            deviceRepo.list()
        ]);

        const subMap = new Map(subs.map(s => [String(s.id), s]));
        const feedMap = new Map(feeders.map(f => [String(f.id), f]));
        const devMap = new Map(devices.map(d => [String(d.id), d]));
        const devMapByCode = new Map(devices.map(d => [String(d.device_code), d]));
        const devMapByIdStr = new Map(devices.map(d => [String(d.device_id), d]));

        function getDev(devId) {
            return devMap.get(String(devId)) || devMapByCode.get(String(devId)) || devMapByIdStr.get(String(devId));
        }

        const subA: any = subMap.get(String(loop.substation_id_a));
        const subB: any = subMap.get(String(loop.substation_id_b));
        const feedA: any = feedMap.get(String(loop.feeder_id_a));
        const feedB: any = feedMap.get(String(loop.feeder_id_b));
        
        const devA: any = getDev(loop.device_id_a);
        const devB: any = getDev(loop.device_id_b);
        const devMain: any = getDev(loop.loop_device_id);

        const enrichedLoop = {
            ...loop,
            substation_name_a: subA?.name,
            substation_code_a: subA?.substation_code,
            feeder_name_a: feedA?.name,
            feeder_code_a: feedA?.feeder_code,
            device_name_a: devA?.name,
            device_code_a: devA?.device_code,
            device_type_a: devA?.device_type,
            switch_status_a: devA?.switch_status,
            
            substation_name_b: subB?.name,
            substation_code_b: subB?.substation_code,
            feeder_name_b: feedB?.name,
            feeder_code_b: feedB?.feeder_code,
            device_name_b: devB?.name,
            device_code_b: devB?.device_code,
            device_type_b: devB?.device_type,
            switch_status_b: devB?.switch_status,
            
            loop_device_name: devMain?.name,
            loop_device_code: devMain?.device_code,
            loop_device_type: devMain?.device_type,
            loop_device_switch_status: devMain?.switch_status,
            loop_device_status: devMain?.status,
            loop_device_pole: devMain?.pole_number,
            loop_device_unit: devMain?.unit,
            loop_device_team: devMain?.team,
            loop_device_latitude: devMain?.latitude,
            loop_device_longitude: devMain?.longitude,
        };

        const db = getTargetFirestore();
        let versionsSnapshot: any = await db.collection('topology_versions').where('loop_id', '==', id).get();
        let versions: any[] = versionsSnapshot.docs.map(d => ({id: d.id, ...d.data()}));
        
        let targetVersion: any = null;
        if (versionIdParam) {
            targetVersion = versions.find(v => v.id === String(versionIdParam));
        } else {
            targetVersion = versions.find(v => v.status === 'PUBLISHED' || v.status === 'APPROVED');
            if (!targetVersion && versions.length > 0) {
                // Get most recent draft/submitted
                versions.sort((a,b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
                targetVersion = versions[0];
            }
        }

        let nodes = [];
        let edges = [];
        let changeRequests = [];

        if (targetVersion) {
            let nSnap = await db.collection('topology_nodes').where('version_id', '==', targetVersion.id).get();
            nodes = nSnap.docs.map(d => ({id: d.id, ...d.data()}));
            let eSnap = await db.collection('topology_edges').where('version_id', '==', targetVersion.id).get();
            edges = eSnap.docs.map(d => ({id: d.id, ...d.data()}));
        }

        return res.json({
            success: true,
            loop: enrichedLoop,
            versions,
            targetVersion,
            nodes,
            edges,
            changeRequests
        });
    }

    const loop = dbQueryOne(
      `
      SELECT 
        l.*,
        sa.name as substation_name_a, sa.substation_code as substation_code_a,
        fa.name as feeder_name_a, fa.feeder_code as feeder_code_a,
        da.name as device_name_a, da.device_code as device_code_a, da.device_type as device_type_a, da.switch_status as switch_status_a,
        sb.name as substation_name_b, sb.substation_code as substation_code_b,
        fb.name as feeder_name_b, fb.feeder_code as feeder_code_b,
        db.name as device_name_b, db.device_code as device_code_b, db.device_type as device_type_b, db.switch_status as switch_status_b,
        dmain.name as loop_device_name, dmain.device_code as loop_device_code, dmain.device_type as loop_device_type,
        dmain.switch_status as loop_device_switch_status, dmain.status as loop_device_status,
        dmain.pole_number as loop_device_pole, dmain.unit as loop_device_unit, dmain.team as loop_device_team,
        dmain.latitude as loop_device_latitude, dmain.longitude as loop_device_longitude, dmain.google_maps_url as loop_device_maps_url,
        (SELECT image_url FROM device_images WHERE device_id = dmain.id AND is_primary = 1 LIMIT 1) as loop_device_image
      FROM loops l
      LEFT JOIN loop_endpoints ea ON l.id = ea.loop_id AND ea.endpoint_role = 'MAIN_SOURCE'
      LEFT JOIN substations sa ON ea.substation_id = sa.id
      LEFT JOIN feeders fa ON ea.feeder_id = fa.id
      LEFT JOIN devices da ON (ea.device_id = da.device_id OR ea.device_id = CAST(da.id AS TEXT))
      LEFT JOIN loop_endpoints eb ON l.id = eb.loop_id AND eb.endpoint_role = 'BACKUP_SOURCE'
      LEFT JOIN substations sb ON eb.substation_id = sb.id
      LEFT JOIN feeders fb ON eb.feeder_id = fb.id
      LEFT JOIN devices db ON (eb.device_id = db.device_id OR eb.device_id = CAST(db.id AS TEXT))
      LEFT JOIN devices dmain ON (l.loop_device_id = dmain.device_id OR l.loop_device_id = CAST(dmain.id AS TEXT))
      WHERE l.id = ? AND l.deleted_at IS NULL
    `,
      [id]
    );

    if (!loop) {
      return res.status(404).json({ success: false, message: 'Khép vòng không tồn tại' });
    }

    // Get all versions history for this loop
    const versions = dbQuery(
      `SELECT * FROM topology_versions WHERE loop_id = ? ORDER BY id DESC`,
      [id]
    );

    // Determine target version
    let targetVersion: any = null;
    if (versionIdParam) {
      targetVersion = dbQueryOne(
        `SELECT * FROM topology_versions WHERE id = ? AND loop_id = ?`,
        [String(versionIdParam), id]
      );
    }

    if (!targetVersion && versions.length > 0) {
      // Prefer PUBLISHED or APPROVED version, else latest version
      targetVersion = versions.find((v: any) => v.status === 'PUBLISHED' || v.status === 'APPROVED') || versions[0];
    }

    let nodes: any[] = [];
    let edges: any[] = [];

    if (targetVersion) {
      // Fetch nodes from topology_nodes table or parse nodes_json
      const nodeRows = dbQuery(
        `SELECT tn.*, d.*, tn.id as node_table_id 
         FROM topology_nodes tn
         LEFT JOIN devices d ON tn.device_id = d.device_id
         WHERE tn.version_id = ?`,
        [targetVersion.id]
      );

      const seenDeviceIds = new Set<string>();
      nodes = [];
      for (const row of nodeRows) {
        // If exact device duplicate in same version, keep first
        if (seenDeviceIds.has(row.device_id)) continue;
        seenDeviceIds.add(row.device_id);

        nodes.push({
          id: row.node_table_id,
          loop_id: row.loop_id,
          version_id: row.version_id,
          device_id: row.device_id,
          pos_x: row.pos_x,
          pos_y: row.pos_y,
          device: {
            id: row.id,
            device_id: row.device_id,
            device_code: row.device_code,
            name: row.name || row.device_id,
            device_type: row.device_type || 'LBS',
            pole_number: row.pole_number,
            feeder_id: row.feeder_id,
            substation_id: row.substation_id,
            unit: row.unit,
            team: row.team,
            status: row.status,
            switch_status: row.switch_status || 'UNKNOWN',
            scada_status: row.scada_status || 'UNKNOWN',
            relay_79: row.relay_79 || 'N_A'
          }
        });
      }

      // Fetch edges from topology_edges table
      const edgeRows = dbQuery(
        `SELECT * FROM topology_edges WHERE version_id = ?`,
        [targetVersion.id]
      );

      edges = edgeRows.map(e => ({
        id: e.id,
        loop_id: e.loop_id,
        version_id: e.version_id,
        source_device_id: e.source_device_id,
        target_device_id: e.target_device_id,
        connection_type: e.connection_type || 'OVERHEAD',
        status: e.status || 'ACTIVE',
        created_by: e.created_by,
        created_at: e.created_at
      }));

      // Fallback if DB tables empty but nodes_json exists
      if (nodes.length === 0 && targetVersion.nodes_json) {
        try {
          const parsedNodes = JSON.parse(targetVersion.nodes_json);
          nodes = parsedNodes.map((pn: any) => {
            const dev = dbQueryOne(`SELECT * FROM devices WHERE device_id = ?`, [pn.device_id]);
            return {
              device_id: pn.device_id,
              pos_x: pn.pos_x,
              pos_y: pn.pos_y,
              device: dev || { device_id: pn.device_id, name: pn.device_id, device_type: 'LBS' }
            };
          });
        } catch (e) {
          console.error('Failed to parse nodes_json', e);
        }
      }

      if (edges.length === 0 && targetVersion.edges_json) {
        try {
          edges = JSON.parse(targetVersion.edges_json);
        } catch (e) {
          console.error('Failed to parse edges_json', e);
        }
      }
    }

    // Check pending change request
    const pendingRequest = dbQueryOne(
      `SELECT * FROM topology_change_requests WHERE loop_id = ? AND status = 'PENDING' ORDER BY id DESC LIMIT 1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        loop,
        active_version: targetVersion,
        versions,
        nodes,
        edges,
        pending_request: pendingRequest
      }
    });
  } catch (err: any) {
    console.error('Error getting loop detail:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/loops - Create new loop with strict validation & transaction
router.post('/', authenticateToken, denyGuestMutations, requirePermission('equipment:create'), async (req: AuthenticatedRequest, res) => {
  try {
    if (CORE_DATA_SOURCE === 'firestore') {
        const { loop_id, name, substation_id_a, feeder_id_a, device_id_a, substation_id_b, feeder_id_b, device_id_b, loop_device_id, status, operation_status, configuration_status, notes } = req.body;
        
        if (!loop_id || !name || !substation_id_a || !feeder_id_a || !device_id_a || !substation_id_b || !feeder_id_b || !device_id_b) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ tất cả các thông tin bắt buộc của Khép vòng.' });
        }
        
        const created = await loopRepo.create({
            loop_id, name, substation_id_a, feeder_id_a, device_id_a,
            substation_id_b, feeder_id_b, device_id_b, loop_device_id,
            status: status || 'ACTIVE',
            operating_status: operation_status || 'OPEN',
            operation_status: operation_status || 'OPEN',
            config_status: configuration_status || 'ACTIVE',
            configuration_status: configuration_status || 'ACTIVE',
            notes,
            createdBy: req.user?.username || 'SYSTEM',
            updatedBy: req.user?.username || 'SYSTEM',
        });
        
        recordAuditLog({
            user_id: req.user!.id,
            username: req.user!.username,
            user_fullname: req.user!.full_name,
            action: 'CREATE_LOOP',
            module: 'QUAN_LY_KHEP_VONG',
            target_id: created.id,
            details: `Tạo mạch khép vòng: ${name}`,
            result: 'SUCCESS',
            ip_address: req.ip
        });
        
        return res.status(201).json({ success: true, message: 'Tạo khép vòng thành công.', loopId: created.id });
    }
    const {
      loop_id,
      name,
      substation_id_a,
      feeder_id_a,
      device_id_a,
      substation_id_b,
      feeder_id_b,
      device_id_b,
      loop_device_id,
      status = 'ACTIVE',
      operating_status,
      config_status,
      operation_status = 'OPEN',
      configuration_status = 'ACTIVE',
      latitude,
      longitude,
      google_maps_url,
      inspection_cycle = 'MONTHLY',
      last_inspection_date,
      next_inspection_date,
      assigned_user_id,
      notes
    } = req.body;

    const finalConfigStatus = configuration_status || config_status || status || 'ACTIVE';
    const finalOperStatus = operation_status || operating_status || 'OPEN';

    // 1. Mandatory input check
    if (!loop_id || !name || !substation_id_a || !feeder_id_a || !device_id_a || !substation_id_b || !feeder_id_b || !device_id_b) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ tất cả các thông tin bắt buộc của Khép vòng.' });
    }

    const cleanLoopId = String(loop_id).trim();
    const cleanName = String(name).trim();

    // 2. Check Substations exist and are active
    const subA = dbQueryOne(`SELECT * FROM substations WHERE id = ? AND deleted_at IS NULL AND status != 'INACTIVE'`, [substation_id_a]);
    if (!subA) {
      return res.status(400).json({ success: false, message: 'Trạm 110kV A không tồn tại hoặc ở trạng thái ngưng hoạt động.' });
    }

    const subB = dbQueryOne(`SELECT * FROM substations WHERE id = ? AND deleted_at IS NULL AND status != 'INACTIVE'`, [substation_id_b]);
    if (!subB) {
      return res.status(400).json({ success: false, message: 'Trạm 110kV B không tồn tại hoặc ở trạng thái ngưng hoạt động.' });
    }

    // 3. Check Feeders exist and are active
    const feederA = dbQueryOne(`SELECT * FROM feeders WHERE id = ? AND deleted_at IS NULL AND status != 'INACTIVE'`, [feeder_id_a]);
    if (!feederA) {
      return res.status(400).json({ success: false, message: 'Phát tuyến A không tồn tại hoặc ở trạng thái ngưng hoạt động.' });
    }

    const feederB = dbQueryOne(`SELECT * FROM feeders WHERE id = ? AND deleted_at IS NULL AND status != 'INACTIVE'`, [feeder_id_b]);
    if (!feederB) {
      return res.status(400).json({ success: false, message: 'Phát tuyến B không tồn tại hoặc ở trạng thái ngưng hoạt động.' });
    }

    // 4. Validate Feeder belongs to Substation
    if (Number(feederA.substation_id) !== Number(substation_id_a)) {
      return res.status(400).json({
        success: false,
        message: `Phát tuyến "${feederA.name}" (${feederA.feeder_code}) không thuộc Trạm 110kV "${subA.name}" đã chọn.`
      });
    }

    if (Number(feederB.substation_id) !== Number(substation_id_b)) {
      return res.status(400).json({
        success: false,
        message: `Phát tuyến "${feederB.name}" (${feederB.feeder_code}) không thuộc Trạm 110kV "${subB.name}" đã chọn.`
      });
    }

    // 5. Endpoint Uniqueness: Feeder A != Feeder B, Device A != Device B
    if (Number(feeder_id_a) === Number(feeder_id_b)) {
      return res.status(400).json({
        success: false,
        message: 'Phát tuyến đầu A và phát tuyến đầu B không được trùng nhau. Khép vòng phải được tạo giữa hai phát tuyến khác nhau.'
      });
    }

    if (String(device_id_a).trim() === String(device_id_b).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Thiết bị điểm đầu A và điểm đầu B không được trùng nhau.'
      });
    }

    // 6. Check Devices exist, active, and belong to their respective Feeders
    const devA = dbQueryOne(`SELECT * FROM devices WHERE (device_id = ? OR id = ?) AND deleted_at IS NULL AND status != 'INACTIVE'`, [device_id_a, device_id_a]);
    if (!devA) {
      return res.status(400).json({
        success: false,
        message: `Thiết bị đầu A (${device_id_a}) không tồn tại hoặc ở trạng thái ngưng hoạt động.`
      });
    }
    if (Number(devA.feeder_id) !== Number(feeder_id_a)) {
      return res.status(400).json({
        success: false,
        message: `Thiết bị đầu A "${devA.name}" (${devA.device_id}) không thuộc Phát tuyến A "${feederA.name}".`
      });
    }

    const devB = dbQueryOne(`SELECT * FROM devices WHERE (device_id = ? OR id = ?) AND deleted_at IS NULL AND status != 'INACTIVE'`, [device_id_b, device_id_b]);
    if (!devB) {
      return res.status(400).json({
        success: false,
        message: `Thiết bị đầu B (${device_id_b}) không tồn tại hoặc ở trạng thái ngưng hoạt động.`
      });
    }
    if (Number(devB.feeder_id) !== Number(feeder_id_b)) {
      return res.status(400).json({
        success: false,
        message: `Thiết bị đầu B "${devB.name}" (${devB.device_id}) không thuộc Phát tuyến B "${feederB.name}".`
      });
    }

    // Validate main loop device if provided
    let mainLoopDev = null;
    if (loop_device_id) {
      mainLoopDev = dbQueryOne(`SELECT * FROM devices WHERE (device_id = ? OR id = ?) AND deleted_at IS NULL`, [loop_device_id, loop_device_id]);
      if (!mainLoopDev) {
        return res.status(400).json({
          success: false,
          message: `Thiết bị Khép vòng chính (${loop_device_id}) không tồn tại trong danh mục thiết bị thực tế.`
        });
      }
    }

    // Auto inherit GPS / Google Maps URL from loop device if not manually specified
    const finalLat = latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : (mainLoopDev?.latitude || null);
    const finalLng = longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : (mainLoopDev?.longitude || null);
    const finalMapsUrl = google_maps_url || mainLoopDev?.google_maps_url || null;

    // 7. Unique loop_id check
    const existingCode = dbQueryOne(`SELECT id, name, deleted_at FROM loops WHERE loop_id = ?`, [cleanLoopId]);
    if (existingCode) {
      if (existingCode.deleted_at) {
        try {
          dbRun(`DELETE FROM loops WHERE id = ?`, [existingCode.id]);
        } catch (e) {
          dbRun(`UPDATE loops SET loop_id = loop_id || '_del_' || id WHERE id = ?`, [existingCode.id]);
        }
      } else {
        return res.status(400).json({ success: false, message: `Mã khép vòng '${cleanLoopId}' đã tồn tại trong hệ thống.` });
      }
    }

    // 8. Duplicate loop between Feeders check (A->B or B->A)
    const existingLoopPair = dbQueryOne(
      `SELECT id, loop_id, name FROM loops 
       WHERE deleted_at IS NULL 
         AND (
           (feeder_id_a = ? AND feeder_id_b = ?) OR 
           (feeder_id_a = ? AND feeder_id_b = ?)
         )`,
      [feeder_id_a, feeder_id_b, feeder_id_b, feeder_id_a]
    );
    if (existingLoopPair) {
      return res.status(400).json({
        success: false,
        message: `Mạch khép vòng giữa hai phát tuyến "${feederA.feeder_code}" và "${feederB.feeder_code}" đã tồn tại (${existingLoopPair.name} - ${existingLoopPair.loop_id}).`
      });
    }

    const username = req.user?.username || 'SYSTEM';

    // 9. Transaction Wrapper
    try {
      dbRun('BEGIN TRANSACTION;');

      dbRun(
        `INSERT INTO loops (
          loop_id, name, substation_id_a, feeder_id_a, device_id_a,
          substation_id_b, feeder_id_b, device_id_b, loop_device_id,
          status, operating_status, config_status, operation_status, configuration_status,
          latitude, longitude, google_maps_url,
          inspection_cycle, last_inspection_date, next_inspection_date, assigned_user_id,
          notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cleanLoopId, cleanName, substation_id_a, feeder_id_a, devA.device_id,
          substation_id_b, feeder_id_b, devB.device_id, mainLoopDev?.device_id || loop_device_id || null,
          finalConfigStatus, finalOperStatus, finalConfigStatus, finalOperStatus, finalConfigStatus,
          finalLat, finalLng, finalMapsUrl,
          inspection_cycle, last_inspection_date || null, next_inspection_date || null, assigned_user_id || null,
          notes, username
        ]
      );

      const newLoop = dbQueryOne(`SELECT id FROM loops WHERE loop_id = ?`, [cleanLoopId]);
      if (!newLoop) {
        throw new Error('Không thể khởi tạo bản ghi khép vòng mới.');
      }
      const loopDbId = newLoop.id;

      // Initialize initial Version 1.0 Topology according to strict hierarchy:
      // Side A Device -> Loop Main Device -> Side B Device (NO Device A -> Device B edge!)
      const initialNodes: any[] = [
        { device_id: devA.device_id, pos_x: 200, pos_y: 200 }
      ];
      const initialEdges: any[] = [];

      if (mainLoopDev?.device_id && mainLoopDev.device_id !== devA.device_id && mainLoopDev.device_id !== devB.device_id) {
        initialNodes.push({ device_id: mainLoopDev.device_id, pos_x: 450, pos_y: 200 });
        initialNodes.push({ device_id: devB.device_id, pos_x: 700, pos_y: 200 });
        initialEdges.push({ source_device_id: devA.device_id, target_device_id: mainLoopDev.device_id, connection_type: 'OVERHEAD', status: 'ACTIVE' });
        initialEdges.push({ source_device_id: mainLoopDev.device_id, target_device_id: devB.device_id, connection_type: 'OVERHEAD', status: 'ACTIVE' });
      } else {
        if (!initialNodes.some(n => n.device_id === devB.device_id)) {
          initialNodes.push({ device_id: devB.device_id, pos_x: 600, pos_y: 200 });
        }
      }

      dbRun(
        `INSERT INTO topology_versions (
          loop_id, version, status, change_summary, reason, nodes_json, edges_json, created_by, approved_by, approved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          loopDbId,
          '1.0',
          'PUBLISHED',
          'Khởi tạo khép vòng mới',
          'Tạo mới mạch khép vòng từ giao diện',
          JSON.stringify(initialNodes),
          JSON.stringify(initialEdges),
          username,
          username
        ]
      );

      const versionRow = dbQueryOne(`SELECT id FROM topology_versions WHERE loop_id = ? AND version = '1.0'`, [loopDbId]);
      if (!versionRow) {
        throw new Error('Không thể khởi tạo phiên bản sơ đồ topology 1.0.');
      }

      // Save nodes
      for (const n of initialNodes) {
        dbRun(
          `INSERT INTO topology_nodes (loop_id, version_id, device_id, pos_x, pos_y) VALUES (?, ?, ?, ?, ?)`,
          [loopDbId, versionRow.id, n.device_id, n.pos_x, n.pos_y]
        );
      }

      // Save edges
      for (const e of initialEdges) {
        dbRun(
          `INSERT INTO topology_edges (loop_id, version_id, source_device_id, target_device_id, connection_type, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [loopDbId, versionRow.id, e.source_device_id, e.target_device_id, e.connection_type, e.status, username]
        );
      }

      // Audit Log
      dbRun(
        `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
         VALUES (?, ?, ?, 'CREATE_LOOP', 'KHEP_VONG', ?, ?, 'SUCCESS')`,
        [req.user?.id || 1, username, req.user?.full_name || username, cleanLoopId, `Tạo mới Khép vòng ${cleanName} (${cleanLoopId})`]
      );

      dbRun('COMMIT;');

      return res.status(201).json({ success: true, message: 'Tạo khép vòng thành công', loopId: loopDbId });
    } catch (txErr: any) {
      try { dbRun('ROLLBACK;'); } catch (rbErr) {}
      throw txErr;
    }
  } catch (err: any) {
    console.error('Error creating loop:', err);
    try {
      recordAuditLog({
        user_id: req.user?.id || 1,
        username: req.user?.username || 'UNKNOWN',
        user_fullname: req.user?.full_name || 'UNKNOWN',
        action: 'CREATE_LOOP',
        module: 'KHEP_VONG',
        details: `Lỗi tạo khép vòng: ${err?.message || String(err)}`,
        result: 'FAILURE'
      });
    } catch (auditErr) {
      console.error('Failed to write failure audit log:', auditErr);
    }
    return res.status(500).json({ success: false, message: err?.message || String(err) || 'Lỗi hệ thống khi tạo khép vòng.' });
  }
});

// PUT /api/loops/:id - Update Loop metadata
router.put('/:id', authenticateToken, denyGuestMutations, requirePermission('equipment:update'), async (req: AuthenticatedRequest, res) => {
  try {
    if (CORE_DATA_SOURCE === 'firestore') {
        const { id } = req.params;
        const { loop_id, name, substation_id_a, feeder_id_a, device_id_a, substation_id_b, feeder_id_b, device_id_b, loop_device_id, status, operation_status, configuration_status, notes } = req.body;
        
        const loop = await loopRepo.getById(id);
        if (!loop || loop.isDeleted) return res.status(404).json({ success: false, message: 'Khép vòng không tồn tại' });
        
        await loopRepo.update(id, {
            loop_id, name, substation_id_a, feeder_id_a, device_id_a,
            substation_id_b, feeder_id_b, device_id_b, loop_device_id,
            status: status || loop.status,
            operating_status: operation_status || loop.operating_status,
            operation_status: operation_status || loop.operation_status,
            config_status: configuration_status || loop.config_status,
            configuration_status: configuration_status || loop.configuration_status,
            notes,
            updatedBy: req.user?.username || 'SYSTEM'
        });
        
        recordAuditLog({
            user_id: req.user!.id,
            username: req.user!.username,
            user_fullname: req.user!.full_name,
            action: 'UPDATE_LOOP',
            module: 'QUAN_LY_KHEP_VONG',
            target_id: id,
            details: `Cập nhật mạch khép vòng: ${name}`,
            result: 'SUCCESS',
            ip_address: req.ip
        });
        
        return res.json({ success: true, message: 'Cập nhật thành công.' });
    }
    const { id } = req.params;
    const {
      name,
      substation_id_a,
      feeder_id_a,
      device_id_a,
      substation_id_b,
      feeder_id_b,
      device_id_b,
      loop_device_id,
      status,
      operating_status,
      config_status,
      operation_status,
      configuration_status,
      latitude,
      longitude,
      google_maps_url,
      inspection_cycle,
      last_inspection_date,
      next_inspection_date,
      assigned_user_id,
      notes
    } = req.body;

    const loop = dbQueryOne(`SELECT * FROM loops WHERE id = ? AND deleted_at IS NULL`, [id]);
    if (!loop) {
      return res.status(404).json({ success: false, message: 'Khép vòng không tồn tại' });
    }

    const finalConfigStatus = configuration_status || config_status || status;
    const finalOperStatus = operation_status || operating_status;

    const username = req.user?.username || 'SYSTEM';

    dbRun(
      `
      UPDATE loops SET
        name = COALESCE(?, name),
        substation_id_a = COALESCE(?, substation_id_a),
        feeder_id_a = COALESCE(?, feeder_id_a),
        device_id_a = COALESCE(?, device_id_a),
        substation_id_b = COALESCE(?, substation_id_b),
        feeder_id_b = COALESCE(?, feeder_id_b),
        device_id_b = COALESCE(?, device_id_b),
        loop_device_id = COALESCE(?, loop_device_id),
        status = COALESCE(?, status),
        operating_status = COALESCE(?, operating_status),
        config_status = COALESCE(?, config_status),
        operation_status = COALESCE(?, operation_status),
        configuration_status = COALESCE(?, configuration_status),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        google_maps_url = COALESCE(?, google_maps_url),
        inspection_cycle = COALESCE(?, inspection_cycle),
        last_inspection_date = COALESCE(?, last_inspection_date),
        next_inspection_date = COALESCE(?, next_inspection_date),
        assigned_user_id = COALESCE(?, assigned_user_id),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP,
        updated_by = ?
      WHERE id = ?
    `,
      [
        name,
        substation_id_a,
        feeder_id_a,
        device_id_a,
        substation_id_b,
        feeder_id_b,
        device_id_b,
        loop_device_id,
        finalConfigStatus,
        finalOperStatus,
        finalConfigStatus,
        finalOperStatus,
        finalConfigStatus,
        latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : null,
        longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : null,
        google_maps_url,
        inspection_cycle,
        last_inspection_date,
        next_inspection_date,
        assigned_user_id,
        notes,
        username,
        id
      ]
    );

    // Audit Log
    dbRun(
      `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
       VALUES (?, ?, ?, 'UPDATE_LOOP', 'KHEP_VONG', ?, ?, 'SUCCESS')`,
      [req.user?.id || 1, username, req.user?.full_name || username, loop.loop_id, `Cập nhật thông tin khép vòng ${loop.loop_id}`]
    );

    res.json({ success: true, message: 'Cập nhật khép vòng thành công' });
  } catch (err: any) {
    console.error('Error updating loop:', err);
    recordAuditLog({
      user_id: req.user?.id || 0,
      username: req.user?.username || 'UNKNOWN',
      user_fullname: req.user?.full_name || 'UNKNOWN',
      action: 'UPDATE_LOOP',
      module: 'KHEP_VONG',
      target_id: req.params.id,
      details: `Lỗi cập nhật khép vòng: ${err.message}`,
      result: 'FAILURE'
    });
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/loops/:id - Soft Delete Loop with full dependency validation
router.delete('/:id', authenticateToken, denyGuestMutations, requirePermission('equipment:delete'), async (req: AuthenticatedRequest, res) => {
  try {
    if (CORE_DATA_SOURCE === 'firestore') {
        const { id } = req.params;
        const loop = await loopRepo.getById(id);
        if (!loop || loop.isDeleted) return res.status(404).json({ success: false, message: 'Khép vòng không tồn tại' });
        
        await loopRepo.delete(id, req.user?.username || 'SYSTEM');
        
        recordAuditLog({
            user_id: req.user!.id,
            username: req.user!.username,
            user_fullname: req.user!.full_name,
            action: 'DELETE_LOOP',
            module: 'QUAN_LY_KHEP_VONG',
            target_id: id,
            details: `Xóa mạch khép vòng: ${loop.name}`,
            result: 'SUCCESS',
            ip_address: req.ip
        });
        
        return res.json({ success: true, message: 'Xóa khép vòng thành công.' });
    }
    const { id } = req.params;
    const loop = dbQueryOne(`SELECT * FROM loops WHERE id = ? AND deleted_at IS NULL`, [id]);
    if (!loop) {
      return res.status(404).json({ success: false, message: 'Khép vòng không tồn tại hoặc đã bị xóa' });
    }

    const username = req.user?.username || 'SYSTEM';

    // 1. Check Pending Approvals / Change Requests
    const pendingApprovals = dbQuery(
      `SELECT id, version_str, requester_fullname, created_at, status, reason
       FROM topology_change_requests
       WHERE loop_id = ? AND status = 'PENDING'`,
      [loop.id]
    );

    // 2. Identify devices associated with this loop
    const topoNodes = dbQuery(`SELECT DISTINCT device_id FROM topology_nodes WHERE loop_id = ?`, [loop.id]);
    const deviceCodes = Array.from(
      new Set(
        [loop.device_id_a, loop.device_id_b, ...topoNodes.map((n: any) => n.device_id)].filter(Boolean)
      )
    );

    let deviceDbIds: number[] = [];
    if (deviceCodes.length > 0) {
      const placeholders = deviceCodes.map(() => '?').join(',');
      const devRows = dbQuery(`SELECT id FROM devices WHERE device_id IN (${placeholders}) AND deleted_at IS NULL`, deviceCodes);
      deviceDbIds = devRows.map((d: any) => d.id);
    }

    // 3. Check Active Tasks linked to devices in this loop
    let activeTasks: any[] = [];
    if (deviceDbIds.length > 0) {
      const placeholders = deviceDbIds.map(() => '?').join(',');
      activeTasks = dbQuery(
        `SELECT id, task_code, title, status, priority, due_date
         FROM tasks
         WHERE device_id IN (${placeholders}) AND status NOT IN ('COMPLETED', 'CANCELLED')`,
        deviceDbIds
      );
    }

    // 4. Check Unresolved Issues linked to devices in this loop
    let activeIssues: any[] = [];
    if (deviceDbIds.length > 0) {
      const placeholders = deviceDbIds.map(() => '?').join(',');
      activeIssues = dbQuery(
        `SELECT id, issue_code, title, status, severity
         FROM issues
         WHERE device_id IN (${placeholders}) AND status NOT IN ('RESOLVED', 'CLOSED')`,
        deviceDbIds
      );
    }

    // 5. Check Active Inspection Schedules linked to devices in this loop
    let activeSchedules: any[] = [];
    if (deviceDbIds.length > 0) {
      const placeholders = deviceDbIds.map(() => '?').join(',');
      activeSchedules = dbQuery(
        `SELECT id, schedule_code, title, frequency, status
         FROM inspection_schedules
         WHERE device_id IN (${placeholders}) AND status = 'ACTIVE'`,
        deviceDbIds
      );
    }

    const hasBlockingUsage =
      pendingApprovals.length > 0 ||
      activeTasks.length > 0 ||
      activeIssues.length > 0 ||
      activeSchedules.length > 0;

    if (hasBlockingUsage) {
      recordAuditLog({
        user_id: req.user?.id || 0,
        username: req.user?.username || 'UNKNOWN',
        user_fullname: req.user?.full_name || 'UNKNOWN',
        action: 'DELETE_LOOP_BLOCKED',
        module: 'KHEP_VONG',
        target_id: loop.loop_id,
        details: `Từ chối xóa khép vòng "${loop.name}" [${loop.loop_id}] do đang có dữ liệu liên quan trong hệ thống.`,
        result: 'FAILURE',
        ip_address: req.ip
      });

      return res.status(409).json({
        success: false,
        message: 'Không thể xóa khép vòng vì đang có dữ liệu liên quan.',
        usage: {
          pending_approvals: pendingApprovals,
          active_tasks: activeTasks,
          active_issues: activeIssues,
          active_schedules: activeSchedules
        }
      });
    }

    // Perform Soft Delete on Loop record (Devices, versions, topology change requests are completely preserved)
    dbRun(`UPDATE loops SET deleted_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?`, [username, id]);

    // Audit Log for successful soft delete
    recordAuditLog({
      user_id: req.user?.id || 0,
      username: username,
      user_fullname: req.user?.full_name || username,
      action: 'DELETE_LOOP',
      module: 'KHEP_VONG',
      target_id: loop.loop_id,
      details: `Xóa mềm khép vòng thành công: ${loop.name} (${loop.loop_id})`,
      result: 'SUCCESS',
      ip_address: req.ip
    });

    return res.json({
      success: true,
      message: `Đã xóa mềm thành công khép vòng "${loop.name}" (${loop.loop_id})`
    });
  } catch (err: any) {
    console.error('Error deleting loop:', err);
    recordAuditLog({
      user_id: req.user?.id || 0,
      username: req.user?.username || 'UNKNOWN',
      user_fullname: req.user?.full_name || 'UNKNOWN',
      action: 'DELETE_LOOP',
      module: 'KHEP_VONG',
      target_id: req.params.id,
      details: `Lỗi server khi xóa khép vòng: ${err.message}`,
      result: 'FAILURE'
    });
    return res.status(500).json({ success: false, message: 'Lỗi server khi xóa khép vòng' });
  }
});

// POST /api/loops/:id/versions - Create/Save a new topology version
router.post('/:id/versions', authenticateToken, denyGuestMutations, requirePermission('equipment:update'), (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { nodes, edges, change_summary, reason, submit_for_approval = false } = req.body;

    const loop = dbQueryOne(`SELECT * FROM loops WHERE id = ? AND deleted_at IS NULL`, [id]);
    if (!loop) {
      return res.status(404).json({ success: false, message: 'Khép vòng không tồn tại' });
    }

    if (!Array.isArray(nodes)) {
      return res.status(400).json({ success: false, message: 'Dữ liệu nodes không hợp lệ' });
    }
    
    // Automatically generate sequential edges if missing
    let finalEdges = Array.isArray(edges) ? edges : [];
    if (finalEdges.length === 0 && nodes.length > 1) {
      for (let i = 0; i < nodes.length - 1; i++) {
        finalEdges.push({
          source_device_id: nodes[i].device_id,
          target_device_id: nodes[i + 1].device_id,
          connection_type: 'OVERHEAD',
          status: 'ACTIVE'
        });
      }
    }
    
    const username = req.user?.username || 'SYSTEM';
    const fullname = req.user?.full_name || username;

    // Determine next version number (e.g., 1.0 -> 1.1)
    const latestVersionRow = dbQueryOne(
      `SELECT version FROM topology_versions WHERE loop_id = ? ORDER BY id DESC LIMIT 1`,
      [id]
    );

    let nextVersion = '1.0';
    if (latestVersionRow) {
      const parts = latestVersionRow.version.split('.');
      const major = parseInt(parts[0] || '1', 10);
      const minor = parseInt(parts[1] || '0', 10);
      nextVersion = `${major}.${minor + 1}`;
    }

    const status = submit_for_approval ? 'SUBMITTED' : 'DRAFT';

    dbRun(
      `
      INSERT INTO topology_versions (
        loop_id, version, status, change_summary, reason, nodes_json, edges_json, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        nextVersion,
        status,
        change_summary || `Cập nhật sơ đồ phiên bản ${nextVersion}`,
        reason || 'Chỉnh sửa sơ đồ topology',
        JSON.stringify(nodes),
        JSON.stringify(finalEdges),
        username
      ]
    );

    const versionRow = dbQueryOne(
      `SELECT id FROM topology_versions WHERE loop_id = ? ORDER BY id DESC LIMIT 1`,
      [id]
    );
    const versionDbId = versionRow.id;

    // Save node records in topology_nodes
    for (const n of nodes) {
      dbRun(
        `INSERT INTO topology_nodes (loop_id, version_id, device_id, pos_x, pos_y) VALUES (?, ?, ?, ?, ?)`,
        [id, versionDbId, n.device_id, n.pos_x || 0, n.pos_y || 0]
      );
    }

    // Save edge records in topology_edges
    for (const e of finalEdges) {
      dbRun(
        `INSERT INTO topology_edges (loop_id, version_id, source_device_id, target_device_id, connection_type, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, versionDbId, e.source_device_id, e.target_device_id, e.connection_type || 'OVERHEAD', e.status || 'ACTIVE', username]
      );
    }

    // If submitting for approval, create change request
    if (submit_for_approval) {
      // Get previous version for snapshot
      const prevVersionRow = dbQueryOne(
        `SELECT nodes_json, edges_json FROM topology_versions WHERE loop_id = ? AND status IN ('PUBLISHED', 'APPROVED') ORDER BY id DESC LIMIT 1`,
        [id]
      );

      dbRun(
        `
        INSERT INTO topology_change_requests (
          loop_id, version_id, version_str, requester_username, requester_fullname,
          status, reason, change_summary, before_snapshot, after_snapshot
        ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)
      `,
        [
          id,
          versionDbId,
          nextVersion,
          username,
          fullname,
          reason || 'Đề xuất phê duyệt sơ đồ topology mới',
          change_summary || `Thay đổi sơ đồ khép vòng ${loop.loop_id}`,
          prevVersionRow ? JSON.stringify({ nodes: JSON.parse(prevVersionRow.nodes_json || '[]'), edges: JSON.parse(prevVersionRow.edges_json || '[]') }) : null,
          JSON.stringify({ nodes, edges })
        ]
      );

      // Audit log
      dbRun(
        `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
         VALUES (?, ?, ?, 'SUBMIT_TOPOLOGY_APPROVAL', 'KHEP_VONG', ?, ?, 'SUCCESS')`,
        [req.user?.id || 1, username, fullname, loop.loop_id, `Trình phê duyệt sơ đồ Topology v${nextVersion} cho khép vòng ${loop.loop_id}`]
      );
    } else {
      // Audit log draft save
      dbRun(
        `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
         VALUES (?, ?, ?, 'SAVE_TOPOLOGY_DRAFT', 'KHEP_VONG', ?, ?, 'SUCCESS')`,
        [req.user?.id || 1, username, fullname, loop.loop_id, `Lưu bản nháp Topology v${nextVersion} cho khép vòng ${loop.loop_id}`]
      );
    }

    res.status(201).json({
      success: true,
      message: submit_for_approval ? `Đã gửi yêu cầu phê duyệt sơ đồ v${nextVersion}` : `Đã lưu sơ đồ v${nextVersion}`,
      version: nextVersion,
      versionId: versionDbId
    });
  } catch (err: any) {
    console.error('Error saving topology version:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/loops/:id/restore-version - Restore a previous version by creating a NEW version
router.post('/:id/restore-version', authenticateToken, denyGuestMutations, requirePermission('equipment:update'), (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { version_id, reason } = req.body;

    if (!version_id) {
      return res.status(400).json({ success: false, message: 'Thiếu version_id để khôi phục' });
    }

    const loop = dbQueryOne(`SELECT * FROM loops WHERE id = ? AND deleted_at IS NULL`, [id]);
    if (!loop) {
      return res.status(404).json({ success: false, message: 'Khép vòng không tồn tại' });
    }

    const sourceVersion = dbQueryOne(`SELECT * FROM topology_versions WHERE id = ? AND loop_id = ?`, [version_id, id]);
    if (!sourceVersion) {
      return res.status(404).json({ success: false, message: 'Phiên bản nguồn không tồn tại' });
    }

    const username = req.user?.username || 'SYSTEM';
    const fullname = req.user?.full_name || username;

    // Calculate next version number
    const latestVersionRow = dbQueryOne(
      `SELECT version FROM topology_versions WHERE loop_id = ? ORDER BY id DESC LIMIT 1`,
      [id]
    );

    let nextVersion = '2.0';
    if (latestVersionRow) {
      const parts = latestVersionRow.version.split('.');
      const major = parseInt(parts[0] || '1', 10);
      const minor = parseInt(parts[1] || '0', 10);
      nextVersion = `${major}.${minor + 1}`;
    }

    // Insert new version copying nodes & edges from sourceVersion
    dbRun(
      `
      INSERT INTO topology_versions (
        loop_id, version, status, change_summary, reason, nodes_json, edges_json, created_by, approved_by, approved_at
      ) VALUES (?, ?, 'PUBLISHED', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
      [
        id,
        nextVersion,
        `Khôi phục lại dữ liệu từ phiên bản v${sourceVersion.version}`,
        reason || `Khôi phục sơ đồ về phiên bản v${sourceVersion.version}`,
        sourceVersion.nodes_json,
        sourceVersion.edges_json,
        username,
        username
      ]
    );

    const newVersionRow = dbQueryOne(`SELECT id FROM topology_versions WHERE loop_id = ? ORDER BY id DESC LIMIT 1`, [id]);

    // Copy nodes table
    const sourceNodes = dbQuery(`SELECT * FROM topology_nodes WHERE version_id = ?`, [sourceVersion.id]);
    for (const sn of sourceNodes) {
      dbRun(
        `INSERT INTO topology_nodes (loop_id, version_id, device_id, pos_x, pos_y) VALUES (?, ?, ?, ?, ?)`,
        [id, newVersionRow.id, sn.device_id, sn.pos_x, sn.pos_y]
      );
    }

    // Copy edges table
    const sourceEdges = dbQuery(`SELECT * FROM topology_edges WHERE version_id = ?`, [sourceVersion.id]);
    for (const se of sourceEdges) {
      dbRun(
        `INSERT INTO topology_edges (loop_id, version_id, source_device_id, target_device_id, connection_type, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, newVersionRow.id, se.source_device_id, se.target_device_id, se.connection_type, se.status, username]
      );
    }

    // Audit log
    dbRun(
      `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
       VALUES (?, ?, ?, 'RESTORE_TOPOLOGY_VERSION', 'KHEP_VONG', ?, ?, 'SUCCESS')`,
      [req.user?.id || 1, username, fullname, loop.loop_id, `Khôi phục sơ đồ topology về v${sourceVersion.version} -> Tạo v${nextVersion}`]
    );

    res.json({
      success: true,
      message: `Đã khôi phục thành công sơ đồ về v${sourceVersion.version} (Phiên bản mới: v${nextVersion})`,
      newVersion: nextVersion
    });
  } catch (err: any) {
    console.error('Error restoring topology version:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
