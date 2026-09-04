const fs = require('fs');

let code = fs.readFileSync('server/routes/loops.ts', 'utf8');

const replacement = `
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

    const db = require('../firebaseAdmin').getTargetFirestore();
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
      nextVersion = \`\${major}.\${minor + 1}\`;
    }

    const status = submit_for_approval ? 'SUBMITTED' : 'DRAFT';
    const now = require('firebase-admin/firestore').FieldValue.serverTimestamp();
    
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
      message: submit_for_approval ? \`Đã gửi yêu cầu phê duyệt sơ đồ v\${nextVersion}\` : \`Đã lưu sơ đồ v\${nextVersion}\`,
      version: nextVersion,
      versionId: versionRef.id
    });
  } catch (err: any) {
    console.error('Error saving topology version:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});
`;

// Replace the route from router.post('/:id/versions' to the next router.
const startIdx = code.indexOf("router.post('/:id/versions'");
const endIdx = code.indexOf("router.post('/:id/restore-version'");

if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + replacement + '\n' + code.substring(endIdx);
    fs.writeFileSync('server/routes/loops.ts', code);
    console.log('Replaced route');
} else {
    console.log('Could not find boundaries');
}
