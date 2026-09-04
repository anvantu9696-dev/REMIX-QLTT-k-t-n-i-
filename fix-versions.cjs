const fs = require('fs');
let code = fs.readFileSync('server/routes/loops.ts', 'utf8');

// Replace findLoop with async loopRepo.getById
code = code.replace(
    /router\.post\('\/:id\/versions', authenticateToken, denyGuestMutations, requireRole\(\['ADMIN', 'MANAGER', 'SHIFT_LEADER'\]\), \(req: AuthenticatedRequest, res\) => \{/,
    "router.post('/:id/versions', authenticateToken, denyGuestMutations, requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER']), async (req: AuthenticatedRequest, res) => {"
);

code = code.replace(
    /const loop = findLoop\(id\);/g,
    "const loop = await loopRepo.getById(id);"
);

code = code.replace(
    /let latestVersionRow = null; \/\/ replaced/g,
    "const db = require('../firebaseAdmin').getTargetFirestore();\n    const versionsSnap = await db.collection('topology_versions').where('loop_id', 'in', [loop.id, loop.loop_id, id].filter(Boolean)).orderBy('createdAt', 'desc').limit(1).get();\n    let latestVersionRow = versionsSnap.empty ? null : versionsSnap.docs[0].data();"
);

// We also need to fix the saving of topology versions, nodes, and edges
fs.writeFileSync('server/routes/loops.ts', code);
