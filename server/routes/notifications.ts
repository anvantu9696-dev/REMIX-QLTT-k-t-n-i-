import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware';
import { getTargetFirestore } from '../firebaseAdmin';

const router = Router();
router.use(authenticateToken);

// GET /api/notifications - List user's notifications with optional filter
router.get('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id.toString(); // Ensure string for Firebase
  const { status = 'all', limit = '30' } = req.query;
  const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 30));

  try {
    const db = getTargetFirestore();
    let q = db.collection('notifications').where('user_id', '==', userId);

    if (status === 'unread') {
      q = q.where('is_read', '==', 0); // or false, handle both if possible, but let's assume 0/1 or boolean
    } else if (status === 'read') {
      q = q.where('is_read', '==', 1);
    }
    
    // To order by created_at, we might need a composite index if we filter by is_read, 
    // For simplicity, let's just query without is_read filter if it causes index issues, 
    // but typically we can query and filter in memory if the user doesn't have thousands.
    // Or just rely on Firestore indexes being created.
    q = q.orderBy('created_at', 'desc').limit(pageSize);

    const snapshot = await q.limit(Number(req.query.limit) || 100).get();
    let notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Unread count
    const unreadQ = db.collection('notifications')
      .where('user_id', '==', userId)
      .where('is_read', 'in', [0, false]); // handle both representations
    const unreadSnap = await unreadQ.count().get();
    const unreadCount = unreadSnap.data().count;

    // Handle boolean representations
    notifications = notifications.map((n: any) => ({
      ...n,
      is_read: n.is_read === true || n.is_read === 1 ? 1 : 0
    }));

    if (status === 'unread') {
      notifications = notifications.filter((n: any) => n.is_read === 0);
    } else if (status === 'read') {
      notifications = notifications.filter((n: any) => n.is_read === 1);
    }

    return res.json({
      success: true,
      data: notifications,
      unread_count: unreadCount
    });
  } catch (err: any) {
    console.error('Error fetching notifications:', err);
    // Fallback if index missing
    if (err.message.includes('index')) {
        try {
            const db = getTargetFirestore();
            const snapshot = await db.collection('notifications')
                .where('user_id', '==', userId)
                .get();
            let all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Unread count
            const unreadCount = all.filter((n:any) => n.is_read === 0 || n.is_read === false).length;
            
            // Format and sort in memory
            all = all.map((n: any) => ({
              ...n,
              is_read: n.is_read === true || n.is_read === 1 ? 1 : 0,
              created_at: n.created_at || ''
            }));
            all.sort((a, b) => (b as any).created_at.localeCompare((a as any).created_at));
            
            if (status === 'unread') all = all.filter((n:any) => n.is_read === 0);
            if (status === 'read') all = all.filter((n:any) => n.is_read === 1);
            
            return res.json({
              success: true,
              data: all.slice(0, pageSize),
              unread_count: unreadCount
            });
        } catch (e: any) {
             return res.status(500).json({ success: false, message: e.message });
        }
    }
    return res.status(500).json({ success: false, message: err.message || 'Lỗi hệ thống' });
  }
});

// PATCH /api/notifications/:id/read - Mark single as read
router.patch('/:id/read', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getTargetFirestore();
    const docRef = db.collection('notifications').doc(req.params.id);
    const doc = await docRef.get();
    if (doc.exists && doc.data()?.user_id === req.user!.id.toString()) {
       await docRef.update({ is_read: 1, isRead: true });
    }
    return res.json({ success: true, message: 'Đã đánh dấu đã đọc' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/notifications/mark-all-read - Mark ALL as read
router.patch('/mark-all-read', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getTargetFirestore();
    const snapshot = await db.collection('notifications')
      .where('user_id', '==', req.user!.id.toString())
      .where('is_read', 'in', [0, false])
      .get();
    
    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { is_read: 1, isRead: true });
      });
      await batch.commit();
    }
    return res.json({ success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc' });
  } catch (err: any) {
     // If index fails
     if (err.message.includes('index')) {
         try {
            const db = getTargetFirestore();
            const snapshot = await db.collection('notifications').where('user_id', '==', req.user!.id.toString()).get();
            const batch = db.batch();
            let count = 0;
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.is_read === 0 || data.is_read === false) {
                    batch.update(doc.ref, { is_read: 1, isRead: true });
                    count++;
                }
            });
            if (count > 0) await batch.commit();
            return res.json({ success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc' });
         } catch(e:any) {}
     }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/notifications/clear-read - Remove read notifications
router.delete('/clear-read', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getTargetFirestore();
    const snapshot = await db.collection('notifications')
      .where('user_id', '==', req.user!.id.toString())
      .where('is_read', 'in', [1, true])
      .get();
    
    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }
    return res.json({ success: true, message: 'Đã xóa các thông báo đã đọc' });
  } catch (err: any) {
    if (err.message.includes('index')) {
         try {
            const db = getTargetFirestore();
            const snapshot = await db.collection('notifications').where('user_id', '==', req.user!.id.toString()).get();
            const batch = db.batch();
            let count = 0;
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.is_read === 1 || data.is_read === true) {
                    batch.delete(doc.ref);
                    count++;
                }
            });
            if (count > 0) await batch.commit();
            return res.json({ success: true, message: 'Đã xóa các thông báo đã đọc' });
         } catch(e:any) {}
     }
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
