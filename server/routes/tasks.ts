import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest, denyGuestMutations } from '../middleware.js';
import { getTargetFirestore } from '../firebaseAdmin.js';
import { broadcastRealtimeEvent } from '../events.js';


export function generateTaskCode(offset = 0): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900000) + 100000 + offset;
  return `TASK-${year}-${rand}`;
}

const router = Router();
router.use(authenticateToken);
router.use(denyGuestMutations);

function isTaskAssignee(task: any, user: any) {
  return task.assigned_to_user_id === user.id || task.assigned_to_user_id === String(user.id) || task.assigned_to_username === user.username;
}

function isTaskCreator(task: any, user: any) {
  return task.created_by === user.id || task.created_by === String(user.id) || task.created_by === user.username;
}

function isManagerOrAdmin(user: any) {
  return user.roles.includes('ADMIN') || user.roles.includes('MANAGER');
}

async function recordTaskHistory(taskId: string, user: any, action: string, actionLabel: string, oldStatus: string, newStatus: string, progress: number, notes: string) {
  try {
    const db = getTargetFirestore();
    await db.collection('task_histories').add({
      task_id: taskId,
      user_id: user.id,
      username: user.username,
      user_fullname: user.full_name || '',
      action,
      action_label: actionLabel,
      old_status: oldStatus,
      new_status: newStatus,
      progress: progress || 0,
      notes: notes || '',
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Record history failed:', err);
  }
}

// 1. GET /api/tasks - List all (STAFF only sees their own)
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { status, priority, search } = req.query;
  try {
    const db = getTargetFirestore();
    let query: any = db.collection('tasks').where('deleted_at', '==', null);

    if (status) query = query.where('status', '==', status);
    if (priority) query = query.where('priority', '==', priority);

    // RBAC: STAFF sees assigned, ADMIN/MANAGER sees all
    const isStaff = !isManagerOrAdmin(req.user) && req.user!.roles.includes('STAFF');
    if (isStaff) {
      query = query.where('assigned_to_username', '==', req.user!.username);
    }

    const snapshot = await query.get();
    let tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (search) {
      const s = (search as string).toLowerCase();
      tasks = tasks.filter((t: any) => 
        (t.title || '').toLowerCase().includes(s) || 
        (t.task_code || '').toLowerCase().includes(s) || 
        (t.assigned_to_username || '').toLowerCase().includes(s)
      );
    }

    tasks.sort((a, b) => new Date((b as any).created_at || 0).getTime() - new Date((a as any).created_at || 0).getTime());
    res.json({ success: true, data: tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi' });
  }
});

// 2. GET /api/tasks/my-tasks
router.get('/my-tasks', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getTargetFirestore();
    const snapshot = await db.collection('tasks')
      .where('assigned_to_username', '==', req.user!.username)
      .where('deleted_at', '==', null)
      .get();
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((t: any) => !['COMPLETED', 'CANCELLED'].includes(t.status))
      .sort((a, b) => new Date((b as any).created_at || 0).getTime() - new Date((a as any).created_at || 0).getTime());
    res.json({ success: true, data: tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi' });
  }
});

// 3. GET /api/tasks/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getTargetFirestore();
    const doc = await db.collection('tasks').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Not found' });
    
    const task = doc.data() as any;
    if (task.deleted_at) return res.status(404).json({ success: false, message: 'Not found' });

    if (!isTaskAssignee(task, req.user) && !isTaskCreator(task, req.user) && !isManagerOrAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    res.json({ success: true, data: { id: doc.id, ...task } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi' });
  }
});

// 4. POST /api/tasks
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getTargetFirestore();
    const year = new Date().getFullYear();
    const ts = Date.now().toString().slice(-6);
    const code = `TASK-${year}-${ts}`;

    const taskData = {
      ...req.body,
      task_code: code,
      created_by: req.user!.username,
      status: 'ASSIGNED',
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    };

    const ref = await db.collection('tasks').add(taskData);
    
    await recordTaskHistory(ref.id, req.user, 'TAO_CONG_VIEC', 'Tạo mới', '', 'ASSIGNED', 0, 'Đã giao việc');
    
    broadcastRealtimeEvent({ type: 'CREATE', entity: 'TASK', action: 'CREATE', id: ref.id, data: taskData });

    res.json({ success: true, message: 'Tạo công việc thành công', data: { id: ref.id, ...taskData } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi' });
  }
});

// Utility wrapper for status transitions
async function updateTaskStatus(req: AuthenticatedRequest, res: Response, allowedRolesFn: (task: any, user: any) => boolean, targetStatus: string, actionCode: string, actionLabel: string, defaultProgress: number | null = null, extraData: any = {}) {
  try {
    const db = getTargetFirestore();
    const ref = db.collection('tasks').doc(req.params.id);
    const doc = await ref.get();
    
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Not found' });
    const task = doc.data() as any;
    
    if (!allowedRolesFn(task, req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const updates = {
      status: targetStatus,
      updated_at: new Date().toISOString(),
      ...extraData
    };
    if (defaultProgress !== null) {
      updates.progress = defaultProgress;
    }

    await ref.update(updates);
    
    const notes = req.body.notes || req.body.reason || '';
    await recordTaskHistory(doc.id, req.user, actionCode, actionLabel, task.status, targetStatus, defaultProgress ?? task.progress ?? 0, notes);

    broadcastRealtimeEvent({ type: 'UPDATE', entity: 'TASK', action: 'STATUS', id: doc.id, data: { status: targetStatus } });

    res.json({ success: true, message: 'Đã cập nhật' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi' });
  }
}

// Actions
router.post('/:id/accept', (req, res) => updateTaskStatus(req, res, isTaskAssignee, 'ACCEPTED', 'TIEP_NHAN', 'Tiếp nhận'));
router.post('/:id/start', (req, res) => updateTaskStatus(req, res, isTaskAssignee, 'IN_PROGRESS', 'BAT_DAU', 'Bắt đầu', 10));

router.put('/:id/progress', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { progress, notes } = req.body;
    const db = getTargetFirestore();
    const ref = db.collection('tasks').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ success: false });
    
    const task = doc.data() as any;
    if (!isTaskAssignee(task, req.user) && !isManagerOrAdmin(req.user)) return res.status(403).json({ success: false });

    await ref.update({ progress, updated_at: new Date().toISOString() });
    await recordTaskHistory(doc.id, req.user, 'CAP_NHAT_TIEN_DO', 'Cập nhật tiến độ', task.status, task.status, progress, notes);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.post('/:id/submit-results', (req, res) => updateTaskStatus(req, res, isTaskAssignee, 'REVIEWING', 'BAO_CAO_KET_QUA', 'Báo cáo KQ', 100));
router.post('/:id/approve', (req, res) => updateTaskStatus(req, res, (t, u) => isCreator(t, u) || isManagerOrAdmin(u), 'COMPLETED', 'PHE_DUYET', 'Phê duyệt', 100));
router.post('/:id/reject-completion', (req, res) => updateTaskStatus(req, res, (t, u) => isCreator(t, u) || isManagerOrAdmin(u), 'IN_PROGRESS', 'TU_CHOI_KET_QUA', 'Từ chối KQ', null, { return_reason: req.body.reason }));
router.post('/:id/return', (req, res) => updateTaskStatus(req, res, isTaskAssignee, 'RETURNED', 'TRA_LAI', 'Trả lại', null, { return_reason: req.body.reason }));
router.post('/:id/pause', (req, res) => updateTaskStatus(req, res, isTaskAssignee, 'PAUSED', 'TAM_DUNG', 'Tạm dừng', null, { pause_reason: req.body.reason }));
router.post('/:id/resume', (req, res) => updateTaskStatus(req, res, isTaskAssignee, 'IN_PROGRESS', 'TIEP_TUC', 'Tiếp tục', null, { pause_reason: null }));
router.post('/:id/cancel', (req, res) => updateTaskStatus(req, res, (t, u) => isCreator(t, u) || isManagerOrAdmin(u), 'CANCELLED', 'HUY_CONG_VIEC', 'Hủy', null, { cancel_reason: req.body.reason }));

router.put('/:id/status', (req, res) => {
  const target = req.body.status;
  updateTaskStatus(req, res, (t, u) => true, target, 'CAP_NHAT_TRANG_THAI', 'Cập nhật trạng thái', req.body.progress ?? null, { return_reason: req.body.return_reason });
});

function isCreator(task: any, user: any) {
  return isTaskCreator(task, user);
}

// 16. GET /api/tasks/:id/history
router.get('/:id/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getTargetFirestore();
    const snapshot = await db.collection('task_histories')
      .where('task_id', '==', req.params.id)
      .get();
    const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => new Date((a as any).created_at).getTime() - new Date((b as any).created_at).getTime());
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 17. DELETE /api/tasks/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getTargetFirestore();
    const ref = db.collection('tasks').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ success: false });
    
    if (!isTaskCreator(doc.data(), req.user) && !isManagerOrAdmin(req.user)) {
      return res.status(403).json({ success: false });
    }

    await ref.update({ deleted_at: new Date().toISOString() });
    broadcastRealtimeEvent({ type: 'DELETE', entity: 'TASK', action: 'DELETE', id: doc.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

export default router;
