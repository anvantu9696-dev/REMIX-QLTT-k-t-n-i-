import { Router } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware.js';

const router = Router();
router.use(authenticateToken);

// GET /api/roles - Get list of roles and permissions
router.get('/', requireRole(['ADMIN']), (req: AuthenticatedRequest, res) => {
  const roles = [
    { id: 1, code: 'ADMIN', name: 'ADMIN', description: 'Quản trị viên', level: 1, status: 'ACTIVE' },
    { id: 2, code: 'MANAGER', name: 'MANAGER', description: 'Quản lý', level: 2, status: 'ACTIVE' },
    { id: 25, code: 'SHIFT_LEADER', name: 'SHIFT_LEADER', description: 'Trưởng ca vận hành', level: 2, status: 'ACTIVE' },
    { id: 3, code: 'STAFF', name: 'STAFF', description: 'Nhân viên', level: 3, status: 'ACTIVE' },
    { id: 4, code: 'VIEWER', name: 'VIEWER', description: 'Khách', level: 4, status: 'ACTIVE' },
  ];
  
  const permissions: any[] = [];
  
  return res.json({
    success: true,
    roles,
    permissions
  });
});

export default router;
