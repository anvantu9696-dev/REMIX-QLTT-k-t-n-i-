import { Router } from 'express';
import { authenticateToken, denyGuestMutations, requireRole, AuthenticatedRequest, recordAuditLog } from '../middleware';
import { getTargetFirestore } from '../firebaseAdmin';

const router = Router();
router.use(authenticateToken);
router.use(denyGuestMutations);

// GET /api/documents
router.get('/', requireRole(['ADMIN', 'MANAGER', 'STAFF', 'VIEWER']), async (req: AuthenticatedRequest, res) => {
  try {
    const db = getTargetFirestore();
    const snapshot = await db.collection('documents')
      .where('deleted_at', '==', null)
      .orderBy('created_at', 'desc')
      .get();
    
    let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json({ success: true, data: docs });
  } catch (err: any) {
    if (err.message.includes('index')) {
        try {
            const db = getTargetFirestore();
            const snapshot = await db.collection('documents').get();
            let all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
            all = all.filter(d => !d.deleted_at && !d.isDeleted);
            all.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
            return res.json({ success: true, data: all });
        } catch (e: any) {
            return res.status(500).json({ success: false, message: e.message });
        }
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/documents
router.post('/', requireRole(['ADMIN', 'MANAGER']), async (req: AuthenticatedRequest, res) => {
  const { title, document_code, category, file_url } = req.body;
  
  if (!title || !document_code || !category) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp Tiêu đề, Mã tài liệu và Danh mục' });
  }

  try {
    const db = getTargetFirestore();
    const newDocRef = db.collection('documents').doc();
    await newDocRef.set({
      title,
      document_code,
      category,
      file_url: file_url || '/docs/sample.pdf',
      created_by: req.user!.full_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    });

    await recordAuditLog(
      req.user!.id,
      req.user!.username,
      req.user!.full_name,
      'CREATE_DOCUMENT',
      'TAI_LIEU',
      newDocRef.id,
      `Thêm tài liệu kỹ thuật mới: ${title} (${document_code})`,
      'SUCCESS',
      req.ip || ''
    );

    return res.status(201).json({ success: true, message: 'Đã thêm tài liệu mới thành công' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
