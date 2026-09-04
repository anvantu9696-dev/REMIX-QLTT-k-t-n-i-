const fs = require('fs');
let code = fs.readFileSync('server/routes/loops.ts', 'utf8');

const replacement = `
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

    const db = require('../firebaseAdmin').getTargetFirestore();
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
      nextVersion = \`\${major}.\${minor + 1}\`;
    }
    
    const now = require('firebase-admin/firestore').FieldValue.serverTimestamp();
    const versionRef = db.collection('topology_versions').doc();
    
    await versionRef.set({
      loop_id: loop.id,
      version: nextVersion,
      status: 'DRAFT',
      change_summary: \`Khôi phục từ phiên bản \${sourceVersion.version}\`,
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
      details: \`Khôi phục sơ đồ về v\${sourceVersion.version} (tạo v\${nextVersion})\`,
      result: 'SUCCESS',
      ip_address: req.ip
    });

    res.status(201).json({
      success: true,
      message: \`Đã tạo bản nháp v\${nextVersion} từ v\${sourceVersion.version}\`,
      version: nextVersion,
      versionId: versionRef.id
    });
  } catch (err: any) {
    console.error('Error restoring topology version:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});
`;

const startIdx = code.indexOf("router.post('/:id/restore-version'");
const endIdx = code.indexOf("export default router;");

if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + replacement + '\n' + code.substring(endIdx);
    fs.writeFileSync('server/routes/loops.ts', code);
    console.log('Replaced restore-version');
} else {
    console.log('Could not find boundaries');
}
