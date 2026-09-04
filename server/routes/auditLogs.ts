import { Router, Response } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware';
import { auditLogRepo } from '../repositories/firestore/auditLogRepository';

const router = Router();
router.use(authenticateToken);
router.use(requireRole(['ADMIN', 'MANAGER']));

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { 
    search, module, action, result, 
    start_date, end_date, 
    limit = '20', lastDocId, lastCreatedAt 
  } = req.query;

  try {
    // Enforce limit constraint: default 20, max 50. Never allow unbounded query.
    const rawLimit = parseInt(limit as string, 10);
    const parsedLimit = Math.min(Math.max(1, isNaN(rawLimit) ? 20 : rawLimit), 50);

    const resultData = await auditLogRepo.list({
      search: search as string,
      module: module as string,
      action: action as string,
      result: result as string,
      start_date: start_date as string,
      end_date: end_date as string,
      limit: parsedLimit,
      lastDocId: lastDocId as string,
      lastCreatedAt: lastCreatedAt as string
    });

    return res.json(resultData);
  } catch (error: any) {
    console.error('Lỗi khi lấy audit logs:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ: ' + error.message });
  }
});

export default router;
