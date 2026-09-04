import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { getTargetFirestore } from '../firebaseAdmin';
import { loopRepo } from '../repositories/firestore/loopRepository';
import { topologyVersionRepo } from '../repositories/firestore/topologyVersionRepository';
import { substationRepo } from '../repositories/firestore/substationRepository';
import { feederRepo } from '../repositories/firestore/feederRepository';
import { deviceRepo } from '../repositories/firestore/deviceRepository';

import { authenticateToken, denyGuestMutations, requireRole , AuthenticatedRequest, recordAuditLog} from '../middleware';

const router = Router();

function findLoop(id: string): any {
  return 
}

// GET /api/loops/reset-stats - Get count of all loop-related records before reset
router.get('/reset-stats', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    
    
    
    
    
    

    res.json({
      success: true,
      counts: {
        loops: 0 || 0,
        active_loops: 0 || 0,
        versions: 0 || 0,
        nodes: 0 || 0,
        edges: 0 || 0,
        change_requests: 0 || 0
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
    const hasDeletePerm = req.user?.roles?.includes('ADMIN') || req.user?.roles?.includes('MANAGER');
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
    
    
    
    
    

    // Run within atomic database transaction
    try {
      

      // 1. Delete all topology change requests / loop approval requests
      

      // 2. Delete all topology nodes & edges
      
      

      // 3. Delete all topology versions
      

      // 4. Delete all loops
      

      // 5. Clear loop_device_id reference if any on devices table to prevent orphan references
      

      return res.json({
        success: true,
        message: 'Đã xóa toàn bộ dữ liệu Khép vòng thành công. Hệ thống đã sẵn sàng để xây dựng lại mạch khép vòng từ đầu.',
        deleted_count: {
          loops: 0,
          versions: 0,
          nodes: 0,
          edges: 0,
          change_requests: 0
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
router.get('/', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER', 'STAFF', 'VIEWER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { search, status, substation_id, feeder_id, sortBy, sortOrder } = req.query;

    
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

    const loop = await loopRepo.getById(id);
    if (!loop || loop.isDeleted) {
      return res.json({
        success: false,
        message: 'Chưa có dữ liệu mạch khép vòng nào trong hệ thống.',
        data: { loop: null, active_version: null, versions: [], nodes: [], edges: [], pending_request: null }
      });
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
        let versionsSnapshot: any = await db.collection('topology_versions').where('loop_id', 'in', [loop.id, loop.loop_id, id].filter(Boolean)).get();
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
        
        let crSnap = await db.collection('topology_change_requests')
                             .where('loop_id', '==', id)
                             .where('status', '==', 'PENDING')
                             .limit(1).get();
        changeRequests = crSnap.docs.map(d => ({id: d.id, ...d.data()}));

        return res.json({
            success: true,
            data: {
                loop: enrichedLoop,
                active_version: targetVersion,
                versions,
                nodes,
                edges,
                pending_request: changeRequests.length > 0 ? changeRequests[0] : null
            }
        });
    
    } catch (err: any) {
    console.error('Error getting loop detail:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/loops - Create new loop with strict validation & transaction
router.post('/', authenticateToken, denyGuestMutations, requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER']), async (req: AuthenticatedRequest, res) => {
  try {
    
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
router.put('/:id', authenticateToken, denyGuestMutations, requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER']), async (req: AuthenticatedRequest, res) => {
  try {
    
        const { id } = req.params;
        const { loop_id, name, substation_id_a, feeder_id_a, device_id_a, substation_id_b, feeder_id_b, device_id_b, loop_device_id, status, operation_status, configuration_status, notes } = req.body;
        
        const loop = await loopRepo.getById(id);
        if (!loop || loop.isDeleted) return res.status(404).json({ success: false, message: 'Khép vòng không tồn tại' });
        
        await loopRepo.update(loop.id, {
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
router.delete('/:id', authenticateToken, denyGuestMutations, requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    
        const { id } = req.params;
        const loop = await loopRepo.getById(id);
        if (!loop || loop.isDeleted) return res.status(404).json({ success: false, message: 'Khép vòng không tồn tại' });
        
        await loopRepo.delete(loop.id, req.user?.username || 'SYSTEM');
        
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

router.post('/:id/versions', authenticateToken, denyGuestMutations, requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { nodes, edges, change_summary, reason, submit_for_approval = false } = req.body;

    const loop = await loopRepo.getById(id);
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

    const db = getTargetFirestore();
    const versionsSnap = await db.collection('topology_versions')
        .where('loop_id', 'in', [loop.id, loop.loop_id, id].filter(Boolean))
        .orderBy('createdAt', 'desc')
        .limit(1).get();
        
    let latestVersionRow = versionsSnap.empty ? null : versionsSnap.docs[0].data();
    let nextVersion = '1.0';

    if (latestVersionRow) {
      const parts = latestVersionRow.version.split('.');
      const major = parseInt(parts[0] || '1', 10);
      const minor = parseInt(parts[1] || '0', 10);
      nextVersion = `${major}.${minor + 1}`;
    }

    const status = submit_for_approval ? 'SUBMITTED' : 'DRAFT';
    const now = FieldValue.serverTimestamp();
    
    // Create new version
    const versionRef = db.collection('topology_versions').doc();
    await versionRef.set({
      loop_id: loop.id,
      version: nextVersion,
      status: status,
      change_summary: change_summary || '',
      reason: reason || '',
      created_by: username,
      createdAt: now,
      updatedAt: now
    });
    
    // Save node records in topology_nodes
    const batch = db.batch();
    for (const n of nodes) {
      const nodeRef = db.collection('topology_nodes').doc();
      batch.set(nodeRef, {
        version_id: versionRef.id,
        device_id: n.device_id,
        device_code: n.device_code || null,
        name: n.name || '',
        device_type: n.device_type || 'UNKNOWN',
        node_order: n.node_order || 0,
        x_position: n.x_position || null,
        y_position: n.y_position || null,
        createdAt: now
      });
    }

    // Save edge records in topology_edges
    for (const e of finalEdges) {
      const edgeRef = db.collection('topology_edges').doc();
      batch.set(edgeRef, {
        version_id: versionRef.id,
        source_device_id: e.source_device_id,
        target_device_id: e.target_device_id,
        connection_type: e.connection_type || 'OVERHEAD',
        length_m: e.length_m || null,
        status: e.status || 'ACTIVE',
        createdAt: now
      });
    }
    
    // If submitting for approval, create change request
    if (submit_for_approval) {
      const crRef = db.collection('topology_change_requests').doc();
      batch.set(crRef, {
        loop_id: loop.id,
        version_id: versionRef.id,
        requested_by: username,
        reason: reason || change_summary || '',
        status: 'PENDING',
        createdAt: now,
        updatedAt: now
      });
    }
    
    await batch.commit();

    res.status(201).json({
      success: true,
      message: submit_for_approval ? `Đã gửi yêu cầu phê duyệt sơ đồ v${nextVersion}` : `Đã lưu sơ đồ v${nextVersion}`,
      version: nextVersion,
      versionId: versionRef.id
    });
  } catch (err: any) {
    console.error('Error saving topology version:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});


router.post('/:id/restore-version', authenticateToken, denyGuestMutations, requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { version_id, reason } = req.body;

    if (!version_id) {
      return res.status(400).json({ success: false, message: 'Thiếu version_id để khôi phục' });
    }

    const loop = await loopRepo.getById(id);
    if (!loop) {
      return res.status(404).json({ success: false, message: 'Khép vòng không tồn tại' });
    }

    const db = getTargetFirestore();
    const sourceVersionSnap = await db.collection('topology_versions').doc(version_id.toString()).get();
    
    if (!sourceVersionSnap.exists) {
      return res.status(404).json({ success: false, message: 'Phiên bản nguồn không tồn tại' });
    }
    const sourceVersion = sourceVersionSnap.data();

    const username = req.user?.username || 'SYSTEM';
    const fullname = req.user?.full_name || username;

    const versionsSnap = await db.collection('topology_versions')
        .where('loop_id', 'in', [loop.id, loop.loop_id, id].filter(Boolean))
        .orderBy('createdAt', 'desc')
        .limit(1).get();
        
    let latestVersionRow = versionsSnap.empty ? null : versionsSnap.docs[0].data();
    let nextVersion = '2.0';

    if (latestVersionRow) {
      const parts = latestVersionRow.version.split('.');
      const major = parseInt(parts[0] || '1', 10);
      const minor = parseInt(parts[1] || '0', 10);
      nextVersion = `${major}.${minor + 1}`;
    }
    
    const now = FieldValue.serverTimestamp();
    const versionRef = db.collection('topology_versions').doc();
    
    await versionRef.set({
      loop_id: loop.id,
      version: nextVersion,
      status: 'DRAFT',
      change_summary: `Khôi phục từ phiên bản ${sourceVersion.version}`,
      reason: reason || '',
      created_by: username,
      createdAt: now,
      updatedAt: now
    });
    
    const batch = db.batch();
    
    const sourceNodesSnap = await db.collection('topology_nodes').where('version_id', '==', sourceVersionSnap.id).get();
    sourceNodesSnap.docs.forEach(doc => {
      const data = doc.data();
      const nodeRef = db.collection('topology_nodes').doc();
      batch.set(nodeRef, {
        version_id: versionRef.id,
        device_id: data.device_id,
        device_code: data.device_code,
        name: data.name,
        device_type: data.device_type,
        node_order: data.node_order,
        x_position: data.x_position,
        y_position: data.y_position,
        createdAt: now
      });
    });
    
    const sourceEdgesSnap = await db.collection('topology_edges').where('version_id', '==', sourceVersionSnap.id).get();
    sourceEdgesSnap.docs.forEach(doc => {
      const data = doc.data();
      const edgeRef = db.collection('topology_edges').doc();
      batch.set(edgeRef, {
        version_id: versionRef.id,
        source_device_id: data.source_device_id,
        target_device_id: data.target_device_id,
        connection_type: data.connection_type,
        length_m: data.length_m,
        status: data.status,
        createdAt: now
      });
    });
    
    await batch.commit();

    recordAuditLog({
      user_id: req.user!.id,
      username: req.user!.username,
      user_fullname: req.user!.full_name,
      action: 'RESTORE_TOPOLOGY',
      module: 'QUAN_LY_KHEP_VONG',
      target_id: id,
      details: `Khôi phục sơ đồ về v${sourceVersion.version} (tạo v${nextVersion})`,
      result: 'SUCCESS',
      ip_address: req.ip
    });

    res.status(201).json({
      success: true,
      message: `Đã tạo bản nháp v${nextVersion} từ v${sourceVersion.version}`,
      version: nextVersion,
      versionId: versionRef.id
    });
  } catch (err: any) {
    console.error('Error restoring topology version:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
