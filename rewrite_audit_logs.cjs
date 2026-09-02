const fs = require('fs');

const newCode = `import { Router, Response } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware';
import { getTargetFirestore } from '../firebaseAdmin';

const router = Router();
router.use(authenticateToken);
router.use(requireRole(['ADMIN', 'MANAGER']));

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { 
    search, module, action, result, 
    start_date, end_date, 
    limit = '20', lastDocId 
  } = req.query;

  try {
    const db = getTargetFirestore();
    let query = db.collection('audit_logs').orderBy('timestamp', 'desc');

    if (module) query = query.where('module', '==', module);
    if (action) query = query.where('action', '==', action);
    if (result) query = query.where('result', '==', result);
    
    // In Firestore, if we have inequality filters, they must be on the same field as the first orderBy
    if (start_date) {
        query = query.where('timestamp', '>=', new Date(start_date as string).toISOString());
    }
    if (end_date) {
        const ed = new Date(end_date as string);
        ed.setHours(23,59,59,999);
        query = query.where('timestamp', '<=', ed.toISOString());
    }

    let parsedLimit = parseInt(limit as string, 10) || 20;

    if (lastDocId) {
      const lastDoc = await db.collection('audit_logs').doc(lastDocId as string).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    let snap;
    if (search) {
       snap = await query.limit(100).get(); // fetch more to filter in memory
    } else {
       snap = await query.limit(parsedLimit + 1).get();
    }
    
    let logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    if (search) {
      const term = (search as string).toLowerCase();
      logs = logs.filter(l => 
        (l.username && l.username.toLowerCase().includes(term)) ||
        (l.user_fullname && l.user_fullname.toLowerCase().includes(term)) ||
        (l.details && l.details.toLowerCase().includes(term)) ||
        (l.target_id && String(l.target_id).toLowerCase().includes(term))
      );
      logs = logs.slice(0, parsedLimit + 1);
    }

    const hasMore = logs.length > parsedLimit;
    if (hasMore) {
        logs.pop();
    }

    return res.json({ 
        success: true, 
        data: logs, 
        nextCursor: hasMore ? logs[logs.length - 1].id : undefined
    });
  } catch (error: any) {
    console.error('Lỗi khi lấy audit logs:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ: ' + error.message });
  }
});

export default router;
`;

fs.writeFileSync('server/routes/auditLogs.ts', newCode);
