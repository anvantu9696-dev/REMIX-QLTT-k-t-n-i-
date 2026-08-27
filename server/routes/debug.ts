
import { Router, Request, Response } from 'express';
import { dbQuery } from '../db'; 

const router = Router();

router.get('/debug-proposals', (req: Request, res: Response) => {
  try {
    const allProposals = dbQuery('SELECT status, COUNT(*) as count FROM device_proposals GROUP BY status');
    res.json({ success: true, data: allProposals });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
