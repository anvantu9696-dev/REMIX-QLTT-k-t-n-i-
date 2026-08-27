import { Router } from 'express';
import { dbQuery, dbRun } from '../db';
import { authenticateToken, denyGuestMutations, requirePermission, recordAuditLog, AuthenticatedRequest } from '../middleware';

const router = Router();
router.use(authenticateToken);
router.use(denyGuestMutations);

// GET /api/documents
router.get('/', requirePermission('documents:read'), (req: AuthenticatedRequest, res) => {
  const docs = dbQuery(`SELECT id, title, document_code, category, file_url, created_by, created_at, updated_at FROM documents WHERE deleted_at IS NULL ORDER BY created_at DESC`);
  return res.json({ success: true, data: docs });
});

// POST /api/documents
router.post('/', requirePermission('documents:create'), (req: AuthenticatedRequest, res) => {
  const { title, document_code, category, file_url } = req.body;
  if (!title || !document_code || !category) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp Tiêu đề, Mã tài liệu và Danh mục' });
  }

  dbRun(
    `INSERT INTO documents (title, document_code, category, file_url, created_by) VALUES (?, ?, ?, ?, ?)`,
    [title, document_code, category, file_url || '/docs/sample.pdf', req.user!.full_name]
  );

  recordAuditLog({
    user_id: req.user!.id,
    username: req.user!.username,
    user_fullname: req.user!.full_name,
    action: 'CREATE_DOCUMENT',
    module: 'TAI_LIEU',
    details: `Thêm tài liệu kỹ thuật mới: ${title} (${document_code})`,
    result: 'SUCCESS',
    ip_address: req.ip
  });

  return res.status(201).json({ success: true, message: 'Đã thêm tài liệu mới thành công' });
});

export default router;
