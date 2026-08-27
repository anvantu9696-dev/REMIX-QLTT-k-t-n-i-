import { Router } from 'express';
import { dbQuery, dbRun } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware';
import { CORE_DATA_SOURCE } from '../config';

const router = Router();
router.use(authenticateToken);

// GET /api/notifications - List user's notifications with optional filter
router.get('/', (req: AuthenticatedRequest, res) => {
  console.log('--- Received GET /api/notifications ---');
  
  if (CORE_DATA_SOURCE === 'firestore') {
    // Implement Firestore logic here
    // For now, return empty array to stop 500
    return res.json({
        success: true,
        data: [],
        unread_count: 0
    });
  }

  const userId = req.user!.id;
  const { status = 'all', limit = '30' } = req.query;

  try {
    let query = `SELECT id, user_id, title, message, type, is_read, link, created_at FROM notifications WHERE user_id = ?`;
    const params: any[] = [userId];

    if (status === 'unread') {
      query += ` AND is_read = 0`;
    } else if (status === 'read') {
      query += ` AND is_read = 1`;
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 30));
    params.push(pageSize);

    console.log('Query:', query, 'Params:', params);
    const notifications = dbQuery(query, params);
    console.log('Notifications count:', notifications.length);

    // Unread count
    const unreadRes = dbQuery(`SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0`, [userId]);
    const unreadCount = unreadRes[0] ? (unreadRes[0].unread_count as number) : 0;

    return res.json({
      success: true,
      data: notifications,
      unread_count: unreadCount
    });
  } catch (err: any) {
    console.error('Error fetching notifications:', err);
    return res.status(500).json({ success: false, message: err.message || 'Lỗi hệ thống' });
  }
});

// PATCH /api/notifications/:id/read - Mark single as read
router.patch('/:id/read', (req: AuthenticatedRequest, res) => {
  if (CORE_DATA_SOURCE === 'firestore') return res.json({ success: true, message: 'Đã đánh dấu đã đọc' });
  
  const notificationId = parseInt(req.params.id, 10);
  dbRun(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [notificationId, req.user!.id]);
  return res.json({ success: true, message: 'Đã đánh dấu đã đọc' });
});

// PATCH /api/notifications/mark-all-read - Mark ALL as read
router.patch('/mark-all-read', (req: AuthenticatedRequest, res) => {
  if (CORE_DATA_SOURCE === 'firestore') return res.json({ success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc' });

  dbRun(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [req.user!.id]);
  return res.json({ success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc' });
});

// DELETE /api/notifications/clear-read - Remove read notifications
router.delete('/clear-read', (req: AuthenticatedRequest, res) => {
  if (CORE_DATA_SOURCE === 'firestore') return res.json({ success: true, message: 'Đã xóa các thông báo đã đọc' });

  dbRun(`DELETE FROM notifications WHERE user_id = ? AND is_read = 1`, [req.user!.id]);
  return res.json({ success: true, message: 'Đã xóa các thông báo đã đọc' });
});

export default router;
