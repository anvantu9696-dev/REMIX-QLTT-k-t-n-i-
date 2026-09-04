const fs = require('fs');
let code = fs.readFileSync('server/routes/tasks.ts', 'utf8');

const myTasksReplacement = `// 2. GET /api/tasks/my-tasks
router.get('/my-tasks', async (req: AuthenticatedRequest, res: Response) => {
  const { status, priority, limit = '50', lastDocId } = req.query;
  try {
    const db = getTargetFirestore();
    let query: any = db.collection('tasks')
      .where('assigned_to_username', '==', req.user!.username)
      .where('deleted_at', '==', null);
      
    if (status) query = query.where('status', '==', status);
    if (priority) query = query.where('priority', '==', priority);
    
    query = query.orderBy('created_at', 'desc');

    let parsedLimit = parseInt(limit as string, 10) || 50;
    if (lastDocId) {
      const lastDoc = await db.collection('tasks').doc(lastDocId as string).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }
    
    // We add +20 to limit just in case some are filtered out in memory for archived logic
    const snapshot = await query.limit(parsedLimit + 20).get();
    let tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Memory filter for active tasks (not completed/cancelled) 
    // This is because we don't have a composite index for status + assigned_to_username
    if (!status) {
        tasks = tasks.filter((t: any) => !['COMPLETED', 'CANCELLED'].includes(t.status));
    }
    
    const hasMore = tasks.length > parsedLimit;
    if (hasMore) {
        tasks = tasks.slice(0, parsedLimit);
    }
    
    res.json({ success: true, data: tasks, nextCursor: hasMore ? tasks[tasks.length - 1].id : undefined });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi' });
  }
});`;

code = code.replace(/\/\/ 2\. GET \/api\/tasks\/my-tasks[\s\S]*?\}\);\n  \} catch \(err: any\) \{\n    res\.status\(500\)\.json\(\{ success: false, message: 'Lỗi' \}\);\n  \}\n\}\);/, myTasksReplacement);
fs.writeFileSync('server/routes/tasks.ts', code);
