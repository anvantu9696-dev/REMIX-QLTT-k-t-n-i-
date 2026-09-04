const fs = require('fs');

function rewriteTasks() {
    let code = fs.readFileSync('server/routes/tasks.ts', 'utf8');
    
    // Replace GET /api/tasks
    const getTasksRegex = /router\.get\('\/', async \(req: AuthenticatedRequest, res: Response\) => \{[\s\S]*?\}\);/;
    const newGetTasks = `
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { status, priority, limit = '50', lastDocId } = req.query;
  try {
    const db = getTargetFirestore();
    let query: any = db.collection('tasks').where('deleted_at', '==', null);
    if (status) query = query.where('status', '==', status);
    if (priority) query = query.where('priority', '==', priority);

    const isStaff = (!isManagerOrAdmin(req.user) && !req.user!.roles.includes("SHIFT_LEADER")) && req.user!.roles.includes('STAFF');
    if (isStaff) {
      query = query.where('assigned_to_username', '==', req.user!.username);
    }
    
    query = query.orderBy('created_at', 'desc');

    let parsedLimit = parseInt(limit as string, 10) || 50;
    
    if (lastDocId) {
      const lastDoc = await db.collection('tasks').doc(lastDocId as string).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.limit(parsedLimit + 1).get();
    let tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const hasMore = tasks.length > parsedLimit;
    if (hasMore) {
        tasks.pop();
    }

    res.json({ success: true, data: tasks, nextCursor: hasMore ? tasks[tasks.length - 1].id : undefined });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi' });
  }
});
`.trim();
    code = code.replace(getTasksRegex, newGetTasks);
    
    fs.writeFileSync('server/routes/tasks.ts', code);
}

function rewriteIssues() {
    let code = fs.readFileSync('server/routes/issues.ts', 'utf8');
    const getRegex = /router\.get\('\/', async \(req: AuthenticatedRequest, res: Response\) => \{[\s\S]*?\}\);/;
    const newGet = `
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { status, severity, device_id, limit = '50', lastDocId } = req.query;
  try {
    const db = getTargetFirestore();
    let query: any = db.collection('issues').where('isDeleted', '==', false);
    if (status) query = query.where('status', '==', status);
    if (severity) query = query.where('severity', '==', severity);
    if (device_id) query = query.where('device_id', '==', String(device_id));

    query = query.orderBy('reported_at', 'desc');

    let parsedLimit = parseInt(limit as string, 10) || 50;
    
    if (lastDocId) {
      const lastDoc = await db.collection('issues').doc(lastDocId as string).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.limit(parsedLimit + 1).get();
    let issues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const hasMore = issues.length > parsedLimit;
    if (hasMore) {
        issues.pop();
    }

    res.json({ success: true, data: issues, nextCursor: hasMore ? issues[issues.length - 1].id : undefined });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});
`.trim();
    code = code.replace(getRegex, newGet);
    fs.writeFileSync('server/routes/issues.ts', code);
}

function rewriteSchedules() {
    let code = fs.readFileSync('server/routes/schedules.ts', 'utf8');
    const getRegex = /router\.get\('\/', async \(req: AuthenticatedRequest, res\) => \{[\s\S]*?\}\);/;
    const newGet = `
router.get('/', async (req: AuthenticatedRequest, res) => {
  const { device_id, target_type, limit = '50', lastDocId } = req.query;
  try {
    const db = getTargetFirestore();
    let query: any = db.collection('inspection_schedules')
      .where('deleted_at', '==', null)
      .where('status', 'in', ['ACTIVE', 'PAUSED']);

    if (device_id) query = query.where('device_id', '==', String(device_id));
    if (target_type) query = query.where('target_type', '==', target_type);

    query = query.orderBy('created_at', 'desc');

    let parsedLimit = parseInt(limit as string, 10) || 50;
    
    if (lastDocId) {
      const lastDoc = await db.collection('inspection_schedules').doc(lastDocId as string).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snap = await query.limit(parsedLimit + 1).get();
    let schedules = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const hasMore = schedules.length > parsedLimit;
    if (hasMore) {
        schedules.pop();
    }

    return res.json({ success: true, data: schedules, nextCursor: hasMore ? schedules[schedules.length - 1].id : undefined });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
`.trim();
    code = code.replace(getRegex, newGet);
    fs.writeFileSync('server/routes/schedules.ts', code);
}

function rewriteProposals() {
    let code = fs.readFileSync('server/routes/proposals.ts', 'utf8');
    const getRegex = /router\.get\('\/', async \(req: AuthenticatedRequest, res\) => \{[\s\S]*?\}\);/;
    const newGet = `
router.get('/', async (req: AuthenticatedRequest, res) => {
  const { status, type, limit = '50', lastDocId } = req.query;
  try {
    const db = getTargetFirestore();
    let query: any = db.collection('proposals').where('deleted_at', '==', null);
    if (status) query = query.where('status', '==', status);
    if (type) query = query.where('type', '==', type);

    const isStaff = !isManagerOrAdmin(req.user) && req.user!.roles.includes('STAFF');
    if (isStaff) {
      query = query.where('created_by', '==', req.user!.username);
    }

    query = query.orderBy('created_at', 'desc');

    let parsedLimit = parseInt(limit as string, 10) || 50;
    
    if (lastDocId) {
      const lastDoc = await db.collection('proposals').doc(lastDocId as string).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.limit(parsedLimit + 1).get();
    let proposals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const hasMore = proposals.length > parsedLimit;
    if (hasMore) {
        proposals.pop();
    }

    res.json({ success: true, data: proposals, nextCursor: hasMore ? proposals[proposals.length - 1].id : undefined });
  } catch (err: any) {
    console.error('Error fetching proposals:', err);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});
`.trim();
    code = code.replace(getRegex, newGet);
    fs.writeFileSync('server/routes/proposals.ts', code);
}

rewriteTasks();
rewriteIssues();
rewriteSchedules();
rewriteProposals();

console.log('done');
