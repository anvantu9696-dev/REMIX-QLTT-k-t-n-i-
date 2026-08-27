import { Router } from 'express';
import { dbQuery } from '../db';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware';

const router = Router();
router.use(authenticateToken);

// GET /api/roles - Get list of roles and permissions
router.get('/', requirePermission('users:read'), (req: AuthenticatedRequest, res) => {
  const roles = dbQuery(`SELECT id, code, name, description, level, status FROM roles WHERE status = 'ACTIVE' ORDER BY level ASC`);
  const permissions = dbQuery(`SELECT id, code, module, description, action FROM permissions ORDER BY module, code`);

  return res.json({
    success: true,
    roles,
    permissions
  });
});

export default router;
