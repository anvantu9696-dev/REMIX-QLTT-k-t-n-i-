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

// Helper: Record proposal history
async function recordProposalHistory(
  proposalId: string,
  user: any,
  action: string,
  actionLabel: string,
  oldStatus: string | null,
  newStatus: string | null,
  notes: string | null
) {
  try {
    const db = getTargetFirestore();
    await db.collection('proposal_histories').add({
      proposal_id: proposalId,
      user_id: user.id,
      username: user.username,
      user_fullname: user.full_name || '',
      action,
      action_label: actionLabel,
      old_status: oldStatus,
      new_status: newStatus,
      notes: notes || '',
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to record proposal history:', err);
  }
}

// GET /api/proposals - List all proposals (with filters)
router.get('/', async (req: AuthenticatedRequest, res) => {
  const { status, type, search } = req.query;
  try {
    const db = getTargetFirestore();
    let query: any = db.collection('proposals').where('deleted_at', '==', null);

    if (status) {
      query = query.where('status', '==', status);
    }
    if (type) {
      query = query.where('type', '==', type);
    }

    // Role-based visibility:
    // If not MANAGER/ADMIN, only see own proposals (or those assigned to their department/station if we had that, but for now just their own)
    const isStaff = !isManagerOrAdmin(req.user) && req.user!.roles.includes('STAFF');
    if (isStaff) {
      query = query.where('created_by', '==', req.user!.username);
    }

    const snapshot = await query.get();
    let proposals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (search) {
      const s = (search as string).toLowerCase();
      proposals = proposals.filter((p: any) => 
        (p.title || '').toLowerCase().includes(s) || 
        (p.proposal_code || '').toLowerCase().includes(s)
      );
    }

    proposals.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    res.json({ success: true, data: proposals });
  } catch (err: any) {
    console.error('Error fetching proposals:', err);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

// GET /api/proposals/:id - Get details
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getTargetFirestore();
    const doc = await db.collection('proposals').doc(req.params.id).get();
    
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đề xuất' });
    }
    const data = doc.data() as any;
    if (data.deleted_at) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đề xuất' });
    }

    // Role check: Only creator or Manager/Admin can view
    const isStaff = !isManagerOrAdmin(req.user) && req.user!.roles.includes('STAFF');
    if (isStaff && data.created_by !== req.user!.username) {
       return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
    }

    res.json({ success: true, data: { id: doc.id, ...data } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

// POST /api/proposals - Create a proposal
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { 
      type, title, description, priority, 
      target_device_id, target_station_id, target_feeder_id, target_loop_id,
      budget_estimate, execution_time_estimate,
      related_files,
      target_devices, // array of IDs
      items
    } = req.body;

    if (!title || !type) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
    }

    const year = new Date().getFullYear();
    const ts = Date.now().toString().slice(-6);
    const prefixMap: any = {
      'MAINTENANCE': 'BTR',
      'REPAIR': 'SC',
      'UPGRADE': 'NC',
      'REPLACE': 'TT',
      'NEW_INSTALL': 'TM',
      'OTHER': 'K'
    };
    const prefix = prefixMap[type] || 'DX';
    const code = `${prefix}-${year}-${ts}`;

    const db = getTargetFirestore();
    
    const proposalData = {
      proposal_code: code,
      type,
      title,
      description: description || '',
      priority: priority || 'MEDIUM',
      status: 'DRAFT',
      target_device_id: target_device_id || null,
      target_station_id: target_station_id || null,
      target_feeder_id: target_feeder_id || null,
      target_loop_id: target_loop_id || null,
      budget_estimate: budget_estimate || null,
      execution_time_estimate: execution_time_estimate || null,
      related_files: related_files || null,
      target_devices_list: target_devices || [],
      items: items || [],
      created_by: req.user!.username,
      created_by_fullname: req.user!.full_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    };

    const ref = await db.collection('proposals').add(proposalData);

    await recordProposalHistory(
      ref.id, 
      req.user, 
      'TAO_DE_XUAT', 
      'Tạo mới đề xuất', 
      null, 
      'DRAFT', 
      'Đề xuất được tạo mới'
    );

    broadcastRealtimeEvent({ type: 'CREATE', entity: 'PROPOSAL', action: 'CREATE', id: ref.id, data: proposalData });

    res.json({ success: true, message: 'Tạo đề xuất thành công', data: { id: ref.id, ...proposalData } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

// PUT /api/proposals/:id - Update draft
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id;
    const db = getTargetFirestore();
    const ref = db.collection('proposals').doc(id);
    const doc = await ref.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    }
    const data = doc.data() as any;

    if (data.created_by !== req.user!.username && !isManagerOrAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    if (!['DRAFT', 'RETURNED'].includes(data.status)) {
      return res.status(400).json({ success: false, message: 'Chỉ có thể sửa đề xuất ở trạng thái Nháp hoặc Bị trả lại' });
    }

    const updates = {
      title: req.body.title || data.title,
      type: req.body.type || data.type,
      description: req.body.description !== undefined ? req.body.description : data.description,
      priority: req.body.priority || data.priority,
      target_device_id: req.body.target_device_id !== undefined ? req.body.target_device_id : data.target_device_id,
      target_station_id: req.body.target_station_id !== undefined ? req.body.target_station_id : data.target_station_id,
      target_feeder_id: req.body.target_feeder_id !== undefined ? req.body.target_feeder_id : data.target_feeder_id,
      target_loop_id: req.body.target_loop_id !== undefined ? req.body.target_loop_id : data.target_loop_id,
      budget_estimate: req.body.budget_estimate !== undefined ? req.body.budget_estimate : data.budget_estimate,
      execution_time_estimate: req.body.execution_time_estimate !== undefined ? req.body.execution_time_estimate : data.execution_time_estimate,
      related_files: req.body.related_files !== undefined ? req.body.related_files : data.related_files,
      target_devices_list: req.body.target_devices || data.target_devices_list || [],
      items: req.body.items || data.items || [],
      updated_at: new Date().toISOString()
    };

    await ref.update(updates);
    
    await recordProposalHistory(
      id, 
      req.user, 
      'CAP_NHAT', 
      'Cập nhật nội dung', 
      data.status, 
      data.status, 
      'Cập nhật nội dung đề xuất'
    );

    broadcastRealtimeEvent({ type: 'UPDATE', entity: 'PROPOSAL', action: 'UPDATE', id });

    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

// POST /api/proposals/:id/submit - Submit for approval
router.post('/:id/submit', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id;
    const db = getTargetFirestore();
    const ref = db.collection('proposals').doc(id);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    const data = doc.data() as any;

    if (data.created_by !== req.user!.username) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    if (!['DRAFT', 'RETURNED'].includes(data.status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
    }

    await ref.update({
      status: 'PENDING',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    await recordProposalHistory(
      id,
      req.user,
      'TRINH_DUYET',
      'Trình duyệt',
      data.status,
      'PENDING',
      'Đã gửi yêu cầu phê duyệt'
    );
    
    broadcastRealtimeEvent({ type: 'UPDATE', entity: 'PROPOSAL', action: 'STATUS', id, data: { status: 'PENDING' } });

    res.json({ success: true, message: 'Đã gửi trình duyệt' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

// DELETE /api/proposals/:id
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id;
    const db = getTargetFirestore();
    const ref = db.collection('proposals').doc(id);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    const data = doc.data() as any;

    if (data.created_by !== req.user!.username && !isManagerOrAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    if (!['DRAFT', 'RETURNED'].includes(data.status) && !isManagerOrAdmin(req.user)) {
      return res.status(400).json({ success: false, message: 'Không thể xóa đề xuất đã trình duyệt' });
    }

    await ref.update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    broadcastRealtimeEvent({ type: 'DELETE', entity: 'PROPOSAL', action: 'DELETE', id });

    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

// GET /api/proposals/:id/history
router.get('/:id/history', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getTargetFirestore();
    const snapshot = await db.collection('proposal_histories')
      .where('proposal_id', '==', req.params.id)
      .get();
      
    const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
    res.json({ success: true, data: history });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

export default router;
