import { Router } from 'express';
import { authenticateToken, denyGuestMutations, requireRole, AuthenticatedRequest, recordAuditLog } from '../middleware';
import { getTargetFirestore } from '../firebaseAdmin';
import { broadcastRealtimeEvent } from '../events';
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
  const { device_id, target_type, limit = '50', lastDocId } = req.query;
  try {
    const db = getTargetFirestore();
    let query: any = db.collection('inspection_schedules')
      .where('deleted_at', '==', null)
      .where('status', 'in', ['ACTIVE', 'PAUSED']);

    if (device_id) query = query.where('device_id', '==', String(device_id));
    if (target_type) query = query.where('target_type', '==', target_type);

    query = query.orderBy('created_at', 'desc');

    const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 100);
    
    if (lastDocId) {
      const lastDoc = await db.collection('inspection_schedules').doc(lastDocId as string).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snap = await query.limit(parsedLimit + 1).get();
    let schedules = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const hasMore = schedules.length > parsedLimit;
    if (hasMore) {
        schedules.pop();
    }

    return res.json({ success: true, data: schedules, nextCursor: hasMore ? schedules[schedules.length - 1].id : undefined });
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

    const scheduleData = {
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
       deleted_at: null,
       isDeleted: false,
       created_by: req.user!.id,
       created_by_username: req.user!.username,
       created_at: new Date().toISOString(),
       updated_at: new Date().toISOString()
    };

    await ref.set(scheduleData);

    await recordAuditLog({ user_id: req.user!.id, username: req.user!.username, user_fullname: req.user!.full_name, action: 'CREATE_SCHEDULE', module: 'SCHEDULE', target_id: code, details: `Tạo lịch kiểm tra mới ${code}`, result: 'SUCCESS', ip_address: req.ip || '' });

    broadcastRealtimeEvent({ type: 'CREATE', entity: 'SCHEDULE', action: 'CREATE', id: ref.id, data: { schedule_code: code, title } });

    return res.json({ success: true, data: { id: ref.id, schedule_code: code } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
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
               deleted_at: null,
               isDeleted: false,
               created_by: 1, // system
               created_by_username: 'SYSTEM',
               created_at: now.toISOString()
           });
           
           const nextRun = new Date(now.getTime() + (s.frequency_days * 24 * 3600000));
           batch.update(doc.ref, { last_run_date: now.toISOString(), next_run_date: nextRun.toISOString() });
           count++;
       }
    }
    
    if (count > 0) {
      await batch.commit();
      broadcastRealtimeEvent({ type: 'CREATE', entity: 'TASK', action: 'AUTO_CREATE_BATCH', data: { count } });
    }

    return res.json({ success: true, message: `Đã tạo ${count} công việc tự động từ lịch` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
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
       isDeleted: true,
       deleted_by: req.user!.username,
       deleted_reason: req.body.reason || 'Người dùng xóa'
    });
    broadcastRealtimeEvent({ type: 'DELETE', entity: 'SCHEDULE', action: 'DELETE', id: req.params.id });
    return res.json({ success: true, message: 'Đã xóa lịch kiểm tra' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
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
       isDeleted: false,
       deleted_by: null,
       deleted_reason: null
    });
    broadcastRealtimeEvent({ type: 'UPDATE', entity: 'SCHEDULE', action: 'RESTORE', id: req.params.id });
    return res.json({ success: true, message: 'Đã khôi phục lịch kiểm tra' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

export default router;
