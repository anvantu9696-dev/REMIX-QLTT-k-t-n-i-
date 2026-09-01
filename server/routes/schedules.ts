import { Router } from 'express';
import { authenticateToken, denyGuestMutations, requireRole, AuthenticatedRequest, recordAuditLog } from '../middleware';
import { getTargetFirestore } from '../firebaseAdmin';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticateToken);
router.use(denyGuestMutations);

const generateScheduleCode = async (db: any) => {
  let code = '';
  let unique = false;
  while (!unique) {
     code = 'SCH-' + Math.random().toString(36).substring(2, 8).toUpperCase();
     try {
         const snap = await db.collection('inspection_schedules').where('schedule_code', '==', code).get();
         if (snap.empty) unique = true;
     } catch (e) {
         // fallback
         unique = true;
     }
  }
  return code;
};

// GET /api/schedules - List schedules
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getTargetFirestore();
    const { device_id, target_type } = req.query;
    
    let q: any = db.collection('inspection_schedules').where('deleted_at', '==', null).where('status', 'in', ['ACTIVE', 'PAUSED']);
    const snap = await db.collection('inspection_schedules').get();
    let schedules = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
    
    schedules = schedules.filter(s => !s.deleted_at && !s.isDeleted && s.status !== 'DELETED');
    if (device_id) schedules = schedules.filter(s => String(s.device_id) === String(device_id));
    if (target_type) schedules = schedules.filter(s => s.target_type === target_type);
    
    schedules.sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''));
    return res.json({ success: true, data: schedules });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/schedules - Create schedule
router.post('/', requireRole(['ADMIN', 'MANAGER']), async (req: AuthenticatedRequest, res) => {
  const { title, target_type, device_id, loop_id, checklist_id, frequency_days, start_date, assigned_to_username, auto_create_tasks } = req.body;
  if (!title || !target_type || !checklist_id || !frequency_days || !start_date) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
  }

  try {
    const db = getTargetFirestore();
    const code = await generateScheduleCode(db);
    const ref = db.collection('inspection_schedules').doc();
    
    let uName = null;
    let uFull = null;
    if (assigned_to_username) {
        const uSnap = await db.collection('users').where('username', '==', assigned_to_username).limit(1).get();
        if (!uSnap.empty) {
            uName = uSnap.docs[0].data().username;
            uFull = uSnap.docs[0].data().full_name;
        }
    }

    await ref.set({
       schedule_code: code,
       title, target_type,
       device_id: device_id ? String(device_id) : null,
       loop_id: loop_id ? String(loop_id) : null,
       checklist_id: String(checklist_id),
       frequency_days, start_date,
       assigned_to_username: uName,
       assigned_to_fullname: uFull,
       auto_create_tasks: auto_create_tasks ? 1 : 0,
       status: 'ACTIVE',
       created_by: req.user!.id,
       created_by_username: req.user!.username,
       created_at: new Date().toISOString(),
       updated_at: new Date().toISOString()
    });

    await recordAuditLog({ user_id: req.user!.id, username: req.user!.username, user_fullname: req.user!.full_name, action: 'CREATE_SCHEDULE', module: 'SCHEDULE', target_id: code, details: `Tạo lịch kiểm tra mới ${code}`, result: 'SUCCESS', ip_address: req.ip || '' });

    return res.json({ success: true, data: { id: ref.id, schedule_code: code } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/schedules/trigger-auto - Trigger auto task creation
router.post('/trigger-auto', requireRole(['ADMIN', 'MANAGER']), async (req: AuthenticatedRequest, res) => {
  try {
    const db = getTargetFirestore();
    const snap = await db.collection('inspection_schedules')
      .where('auto_create_tasks', '==', 1)
      .where('status', '==', 'ACTIVE')
      .get();
      
    const now = new Date();
    let count = 0;
    const batch = db.batch();

    for (const doc of snap.docs) {
       const s = doc.data();
       if (s.deleted_at || s.isDeleted) continue;
       const nextDate = s.next_run_date ? new Date(s.next_run_date) : new Date(s.start_date);
       if (now >= nextDate) {
           const tRef = db.collection('tasks').doc();
           batch.set(tRef, {
               task_code: 'TSK-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
               title: s.title,
               description: `Được tạo tự động từ lịch ${s.schedule_code}`,
               task_type: 'INSPECTION',
               target_type: s.target_type,
               device_id: s.device_id,
               loop_id: s.loop_id,
               checklist_id: s.checklist_id,
               priority: 'MEDIUM',
               assigned_to_username: s.assigned_to_username,
               assigned_to_fullname: s.assigned_to_fullname,
               start_date: now.toISOString().split('T')[0],
               due_date: new Date(now.getTime() + 7 * 24 * 3600000).toISOString().split('T')[0],
               status: 'TODO',
               inspection_schedule_id: doc.id,
               created_by: 1, // system
               created_by_username: 'SYSTEM',
               created_at: now.toISOString()
           });
           
           const nextRun = new Date(now.getTime() + (s.frequency_days * 24 * 3600000));
           batch.update(doc.ref, { last_run_date: now.toISOString(), next_run_date: nextRun.toISOString() });
           count++;
       }
    }
    
    if (count > 0) await batch.commit();

    return res.json({ success: true, message: `Đã tạo ${count} công việc tự động từ lịch` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/schedules/:id
router.delete('/:id', requireRole(['ADMIN', 'MANAGER']), async (req: AuthenticatedRequest, res) => {
  try {
    const db = getTargetFirestore();
    const docRef = db.collection('inspection_schedules').doc(req.params.id);
    await docRef.update({ 
       status: 'DELETED', 
       deleted_at: new Date().toISOString(),
       deleted_by: req.user!.username,
       deleted_reason: req.body.reason || 'Người dùng xóa'
    });
    return res.json({ success: true, message: 'Đã xóa lịch kiểm tra' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/schedules/:id/restore
router.post('/:id/restore', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const db = getTargetFirestore();
    const docRef = db.collection('inspection_schedules').doc(req.params.id);
    await docRef.update({ 
       status: 'ACTIVE', 
       deleted_at: null,
       deleted_by: null,
       deleted_reason: null
    });
    return res.json({ success: true, message: 'Đã khôi phục lịch kiểm tra' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
