import { Router } from 'express';
import { dbQuery } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware';

const router = Router();
router.use(authenticateToken);

// GET /api/guides
router.get('/', (req: AuthenticatedRequest, res) => {
  const guides = dbQuery(`SELECT id, title, category, content, created_at, updated_at FROM guides ORDER BY created_at DESC`);
  return res.json({ success: true, data: guides });
});

export default router;
