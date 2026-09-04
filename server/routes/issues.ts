import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest, recordAuditLog } from '../middleware';
import { getTargetFirestore } from '../firebaseAdmin';

const router = Router();
router.use(authenticateToken);

const generateIssueCode = () => {
  return 'IS-' + new Date().getTime().toString().slice(-6) + '-' + Math.floor(Math.random() * 1000);
};

// 1. GET /api/issues - List
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { status, severity, device_id, limit = '50', lastDocId } = req.query;
  try {
    const db = getTargetFirestore();
    let query: any = db.collection('issues').where('isDeleted', '==', false);
    if (status) query = query.where('status', '==', status);
    if (severity) query = query.where('severity', '==', severity);
    if (device_id) query = query.where('device_id', '==', String(device_id));

    query = query.orderBy('reported_at', 'desc');

    let parsedLimit = parseInt(limit as string, 10) || 50;
    
    if (lastDocId) {
      const lastDoc = await db.collection('issues').doc(lastDocId as string).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.limit(parsedLimit + 1).get();
    let issues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const hasMore = issues.length > parsedLimit;
    if (hasMore) {
        issues.pop();
    }

    res.json({ success: true, data: issues, nextCursor: hasMore ? issues[issues.length - 1].id : undefined });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. GET /api/issues/:id - Detail
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getTargetFirestore();
    const doc = await db.collection('issues').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin bất thường' });
    }
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi lấy chi tiết bất thường' });
  }
});

// 3. POST /api/issues - Report new issue (BÁO BẤT THƯỜNG)
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { device_id, title, content, severity, image_url, notes } = req.body;
    if (!device_id || !title || !content || !severity) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn Thiết bị, Tên bất thường, Nội dung và Mức độ nghiêm trọng' });
    }
    
    const db = getTargetFirestore();
    let dData = {} as any;
    try {
       const dDoc = await db.collection('devices').doc(String(device_id)).get();
       if (dDoc.exists) {
           const dat = dDoc.data()!;
           dData = {
               device_code: dat.name || '',
               device_name: dat.name || '',
               device_type: dat.device_type || '',
               pole_number: dat.pole_number || '',
               device_unit: dat.unit || '',
               device_team: dat.team || '',
               latitude: dat.latitude || null,
               longitude: dat.longitude || null
           };
       }
    } catch(e){}

    const code = generateIssueCode();
    const newIssueRef = db.collection('issues').doc();
    const issueData = {
      issue_code: code,
      device_id: String(device_id),
      ...dData,
      title,
      content,
      severity,
      status: 'NEW',
      image_url: image_url || '',
      reported_by_username: req.user?.username || 'SYSTEM',
      reported_by_fullname: req.user?.full_name || 'Hệ thống',
      notes: notes || '',
      reported_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    
    await newIssueRef.set(issueData);

    await recordAuditLog(
      req.user?.id || 1,
      req.user?.username || 'SYSTEM',
      req.user?.full_name || 'Hệ thống',
      'BAO_BAT_THUONG',
      'BAT_THUONG',
      code,
      `Báo bất thường "${title}" mức độ ${severity} trên thiết bị ID #${device_id}`,
      'SUCCESS',
      req.ip || ''
    );

    // If HIGH or CRITICAL, send alert notifications to managers/leads
    if (['HIGH', 'CRITICAL'].includes(severity)) {
       try {
           const batch = db.batch();
           const managers = await db.collection('users')
                .where('roles', 'array-contains-any', ['ADMIN', 'DOI_TRUONG', 'TRUONG_CA'])
                .get();
           managers.docs.forEach(m => {
               const nRef = db.collection('notifications').doc();
               batch.set(nRef, {
                   user_id: m.id,
                   title: `CẢNH BÁO BẤT THƯỜNG [${severity}]: ${code}`,
                   message: `Phát hiện bất thường nghiêm trọng "${title}" tại thiết bị. Vui lòng phân công xử lý khẩn cấp.`,
                   type: 'ALERT',
                   link: `/issues?id=${newIssueRef.id}`,
                   is_read: 0,
                   isRead: false,
                   created_at: new Date().toISOString()
               });
           });
           await batch.commit();
       } catch (e) {
           // Ignore if index missing for array-contains-any, or just ignore failures in notification sending for now
       }
    }

    res.json({ success: true, message: 'Ghi nhận báo bất thường thành công', data: { id: newIssueRef.id, ...issueData } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi khi báo bất thường' });
  }
});

// 4. PUT /api/issues/:id/status
router.put('/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, assigned_to_username, resolution_notes } = req.body;
    const db = getTargetFirestore();
    const docRef = db.collection('issues').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin bất thường' });
    }
    
    let assignedFullname = doc.data()?.assigned_to_fullname;
    if (assigned_to_username) {
        try {
            const uSnap = await db.collection('users').where('username', '==', assigned_to_username).limit(1).get();
            if (!uSnap.empty) assignedFullname = uSnap.docs[0].data().full_name;
        } catch(e){}
    }

    const isResolved = status === 'RESOLVED';
    const isClosed = status === 'CLOSED';
    
    const updateData: any = {
      status,
      assigned_to_username: assigned_to_username || doc.data()?.assigned_to_username || null,
      assigned_to_fullname: assignedFullname || null,
      updated_at: new Date().toISOString()
    };
    
    if (resolution_notes) updateData.resolution_notes = resolution_notes;
    if (isResolved) updateData.resolved_at = new Date().toISOString();
    if (isClosed) {
        updateData.closed_at = new Date().toISOString();
        updateData.closed_by = req.user?.username || 'SYSTEM';
    }

    await docRef.update(updateData);

    const auditAction = isClosed ? 'DONG_BAT_THUONG' : 'CAP_NHAT_BAT_THUONG';
    await recordAuditLog(
      req.user?.id || 1,
      req.user?.username || 'SYSTEM',
      req.user?.full_name || 'Hệ thống',
      auditAction,
      'BAT_THUONG',
      doc.data()?.issue_code || doc.id,
      `Chuyển trạng thái xử lý bất thường "${doc.data()?.title}" sang ${status}`,
      'SUCCESS',
      req.ip || ''
    );

    res.json({ success: true, message: 'Cập nhật trạng thái xử lý bất thường thành công' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái bất thường' });
  }
});

// 5. DELETE /api/issues/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getTargetFirestore();
    await db.collection('issues').doc(req.params.id).update({ isDeleted: true, deleted_at: new Date().toISOString() });
    res.json({ success: true, message: 'Xóa bất thường thành công' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi khi xóa thông tin bất thường' });
  }
});

export default router;
