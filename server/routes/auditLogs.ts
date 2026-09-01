import { Router, Response } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware';
import { getTargetFirestore } from '../firebaseAdmin';

const router = Router();
router.use(authenticateToken);
router.use(requireRole(['ADMIN', 'MANAGER']));

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { 
    search, module, action, result, 
    start_date, end_date, 
    page = '1', limit = '20' 
  } = req.query;

  try {
    const db = getTargetFirestore();
    const snap = await db.collection('audit_logs').orderBy('timestamp', 'desc').get();
    let logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    if (module) logs = logs.filter(l => l.module === module);
    if (action) logs = logs.filter(l => l.action === action);
    if (result) logs = logs.filter(l => l.result === result);
    
    if (start_date) {
        const sd = new Date(start_date as string).getTime();
        logs = logs.filter(l => new Date(l.timestamp).getTime() >= sd);
    }
    if (end_date) {
        // end of day logic
        const ed = new Date(end_date as string);
        ed.setHours(23,59,59,999);
        logs = logs.filter(l => new Date(l.timestamp).getTime() <= ed.getTime());
    }

    if (search) {
      const term = (search as string).toLowerCase();
      logs = logs.filter(l => 
        (l.username && l.username.toLowerCase().includes(term)) ||
        (l.user_fullname && l.user_fullname.toLowerCase().includes(term)) ||
        (l.details && l.details.toLowerCase().includes(term)) ||
        (l.target_id && String(l.target_id).toLowerCase().includes(term))
      );
    }

    const total = logs.length;
    const pageSize = parseInt(limit as string, 10) || 20;
    const currentPage = parseInt(page as string, 10) || 1;
    const offset = (currentPage - 1) * pageSize;

    const pagedLogs = logs.slice(offset, offset + pageSize);

    return res.json({
      success: true,
      data: pagedLogs,
      total,
      page: currentPage,
      limit: pageSize,
      total_pages: Math.ceil(total / pageSize)
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi khi lấy nhật ký hệ thống: ' + error.message });
  }
});

export default router;
