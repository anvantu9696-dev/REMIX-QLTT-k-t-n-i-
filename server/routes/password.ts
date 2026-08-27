import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { dbQueryOne, dbRun } from '../db';
import { authenticateToken, denyGuestMutations, recordAuditLog, AuthenticatedRequest } from '../middleware';

const router = Router();

// Apply auth and guest mutation blocking
router.use(authenticateToken);
router.use(denyGuestMutations);

router.use((req, res, next) => {
  console.log(`[PASSWORD ROUTE] ${req.method} ${req.originalUrl}`);
  next();
});

// PUT /api/password/change/:id - Change password
router.put('/change/:id', async (req: AuthenticatedRequest, res) => {
  const userId = parseInt(req.params.id, 10);
  const { old_password, new_password } = req.body;
  const authUserId = req.user!.id;
  const isSelf = authUserId === userId;
  const isAdmin = req.user!.roles?.includes('ADMIN');

  if (!isSelf && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện hành động này' });
  }

  const user = dbQueryOne(`SELECT id, username, password_hash FROM users WHERE id = ? AND deleted_at IS NULL`, [userId]);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
  }

  // Validate old password if self-changing
  if (isSelf && !isAdmin) {
    if (!old_password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu cũ' });
    }
    const isMatch = await bcrypt.compare(old_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu cũ không đúng' });
    }
  }

  if (!new_password || new_password.trim().length < 6) {
    return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
  }

  const hashedPassword = await bcrypt.hash(new_password.trim(), 10);

  dbRun(
    `UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?`,
    [hashedPassword, req.user!.username, userId]
  );

  recordAuditLog({
    user_id: req.user!.id,
    username: req.user!.username,
    user_fullname: req.user!.full_name,
    action: 'CHANGE_PASSWORD',
    module: 'QUAN_LY_NGUOI_DUNG',
    target_id: userId,
    details: isSelf ? `Người dùng tự đổi mật khẩu` : `Admin đổi mật khẩu người dùng ${user.username}`,
    result: 'SUCCESS',
    ip_address: req.ip
  });

  return res.json({ success: true, message: 'Đổi mật khẩu thành công' });
});

export default router;
