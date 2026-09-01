import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest, denyGuestMutations } from '../middleware.js';
import { getTargetFirestore } from '../firebaseAdmin.js';
import { broadcastRealtimeEvent } from '../events.js';

const router = Router();
router.use(authenticateToken);
router.use(denyGuestMutations);

function isManagerOrAdmin(user: any) {
  return user.roles.includes('ADMIN') || user.roles.includes('MANAGER');
}

// POST /api/approvals/proposals/:id/approve
router.post('/proposals/:id/approve', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id;
    const { notes } = req.body;
    
    if (!isManagerOrAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Chỉ cấp quản lý mới có quyền phê duyệt' });
    }

    const db = getTargetFirestore();
    const ref = db.collection('proposals').doc(id);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    const data = doc.data() as any;

    if (data.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Đề xuất không ở trạng thái chờ duyệt' });
    }

    // Prepare transaction/batch for multiple operations if needed, here just updating proposal
    await ref.update({
      status: 'APPROVED',
      approved_by: req.user!.username,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    await db.collection('proposal_histories').add({
      proposal_id: id,
      user_id: req.user!.id,
      username: req.user!.username,
      user_fullname: req.user!.full_name || '',
      action: 'PHE_DUYET',
      action_label: 'Phê duyệt',
      old_status: data.status,
      new_status: 'APPROVED',
      notes: notes || '',
      created_at: new Date().toISOString()
    });
    
    broadcastRealtimeEvent({ type: 'UPDATE', entity: 'PROPOSAL', action: 'STATUS', id, data: { status: 'APPROVED' } });

    res.json({ success: true, message: 'Đã phê duyệt' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

// POST /api/approvals/proposals/:id/reject
router.post('/proposals/:id/reject', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id;
    const { reason } = req.body;
    
    if (!isManagerOrAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Chỉ cấp quản lý mới có quyền từ chối' });
    }

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do từ chối' });
    }

    const db = getTargetFirestore();
    const ref = db.collection('proposals').doc(id);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    const data = doc.data() as any;

    if (data.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Đề xuất không ở trạng thái chờ duyệt' });
    }

    await ref.update({
      status: 'REJECTED',
      updated_at: new Date().toISOString()
    });

    await db.collection('proposal_histories').add({
      proposal_id: id,
      user_id: req.user!.id,
      username: req.user!.username,
      user_fullname: req.user!.full_name || '',
      action: 'TU_CHOI',
      action_label: 'Từ chối',
      old_status: data.status,
      new_status: 'REJECTED',
      notes: reason,
      created_at: new Date().toISOString()
    });
    
    broadcastRealtimeEvent({ type: 'UPDATE', entity: 'PROPOSAL', action: 'STATUS', id, data: { status: 'REJECTED' } });

    res.json({ success: true, message: 'Đã từ chối' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

// POST /api/approvals/proposals/:id/return
router.post('/proposals/:id/return', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id;
    const { reason } = req.body;
    
    if (!isManagerOrAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Chỉ cấp quản lý mới có quyền trả lại' });
    }

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do trả lại' });
    }

    const db = getTargetFirestore();
    const ref = db.collection('proposals').doc(id);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    const data = doc.data() as any;

    if (data.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Đề xuất không ở trạng thái chờ duyệt' });
    }

    await ref.update({
      status: 'RETURNED',
      updated_at: new Date().toISOString()
    });

    await db.collection('proposal_histories').add({
      proposal_id: id,
      user_id: req.user!.id,
      username: req.user!.username,
      user_fullname: req.user!.full_name || '',
      action: 'TRA_LAI',
      action_label: 'Yêu cầu làm lại',
      old_status: data.status,
      new_status: 'RETURNED',
      notes: reason,
      created_at: new Date().toISOString()
    });
    
    broadcastRealtimeEvent({ type: 'UPDATE', entity: 'PROPOSAL', action: 'STATUS', id, data: { status: 'RETURNED' } });

    res.json({ success: true, message: 'Đã trả lại yêu cầu bổ sung' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

export default router;
