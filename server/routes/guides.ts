import { Router } from 'express';
import { authenticateToken } from '../middleware';
import { getTargetFirestore } from '../firebaseAdmin';
import { getOrFetchCached, TTL_MASTER_DATA, logFirebaseRead } from '../utils/firestoreCache';

const router = Router();
router.use(authenticateToken);

// GET /api/guides - List technical guides (cached 2 hours, simple where query)
router.get('/', async (req, res) => {
  try {
    const guides = await getOrFetchCached(
      'guides_all_active',
      TTL_MASTER_DATA, // 2 hours
      async () => {
        const db = getTargetFirestore();
        const snap = await db.collection('guides').where('isDeleted', '==', false).get();
        logFirebaseRead('guides', 'all_active', snap.size);
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort in memory to avoid complex Firestore composite indexes
        return docs.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
      },
      'guides'
    );
    return res.json({ success: true, data: guides });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
