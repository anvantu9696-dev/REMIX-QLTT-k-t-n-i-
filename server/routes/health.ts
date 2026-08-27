import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    database: 'firestore',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;
