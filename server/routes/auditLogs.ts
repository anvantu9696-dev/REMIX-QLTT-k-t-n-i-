import { Router } from 'express';
import { dbQuery } from '../db';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware';

const router = Router();
router.use(authenticateToken);

// GET /api/audit-logs
router.get('/', requirePermission('audit:read'), (req: AuthenticatedRequest, res) => {
  const { search, module, result, page = '1', limit = '50', from_date, to_date } = req.query;

  let query = `SELECT id, user_id, username, user_fullname, action, module, target_id, details, result, ip_address, created_at FROM audit_logs WHERE 1=1`;
  let countQuery = `SELECT COUNT(*) as total FROM audit_logs WHERE 1=1`;
  const params: any[] = [];

  let whereClauses = '';
  if (search) {
    whereClauses += ` AND (username LIKE ? OR user_fullname LIKE ? OR action LIKE ? OR details LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (module) {
    whereClauses += ` AND module = ?`;
    params.push(module);
  }

  if (result) {
    whereClauses += ` AND result = ?`;
    params.push(result);
  }

  if (from_date) {
    whereClauses += ` AND created_at >= ?`;
    params.push(`${from_date} 00:00:00`);
  }

  if (to_date) {
    whereClauses += ` AND created_at <= ?`;
    params.push(`${to_date} 23:59:59`);
  }

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 50));
  const offset = (pageNum - 1) * pageSize;

  const totalRow = dbQuery(countQuery + whereClauses, params)[0];
  const total = totalRow ? (totalRow.total as number) : 0;

  query += whereClauses + ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const logs = dbQuery(query, [...params, pageSize, offset]);

  return res.json({
    success: true,
    data: logs,
    total,
    page: pageNum,
    pageSize
  });
});

export default router;
