import { Router } from 'express';
import { authenticateToken } from '../middleware';
import { getTargetFirestore } from '../firebaseAdmin';

const router = Router();
router.use(authenticateToken);

// GET /api/guides - List technical guides
router.get('/', async (req, res) => {
  try {
    const db = getTargetFirestore();
    const snap = await db.collection('guides').orderBy('created_at', 'desc').get();
    let guides = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json({ success: true, data: guides });
  } catch (err: any) {
    if (err.message.includes('index')) {
        try {
            const db = getTargetFirestore();
            const snap = await db.collection('guides').get();
            let guides = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
            guides.sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''));
            return res.json({ success: true, data: guides });
        } catch(e:any) {
             return res.status(500).json({ success: false, message: e.message });
        }
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
