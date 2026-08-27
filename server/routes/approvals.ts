import { Router } from 'express';
import { dbQuery, dbQueryOne, dbRun } from '../db';
import { authenticateToken, denyGuestMutations, requirePermission, AuthenticatedRequest } from '../middleware';

const router = Router();

// GET /api/approvals - List all topology change requests
router.get('/', authenticateToken, (req, res) => {
  try {
    const { status, search } = req.query;

    let sql = `
      SELECT 
        tcr.*,
        l.loop_code as loop_id,
        l.name as loop_name,
        tv.version as version_str,
        tv.status as version_status
      FROM topology_change_requests tcr
      JOIN loops l ON tcr.loop_id = l.id
      JOIN topology_versions tv ON tcr.version_id = tv.id
      WHERE l.deleted_at IS NULL
    `;

    const params: any[] = [];

    if (status) {
      sql += ` AND tcr.status = ?`;
      params.push(status);
    }

    if (search) {
      sql += ` AND (l.loop_code LIKE ? OR l.name LIKE ? OR tcr.requester_fullname LIKE ? OR tcr.reason LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY tcr.id DESC`;

    const requests = dbQuery(sql, params);

    res.json({ success: true, data: requests });
  } catch (err: any) {
    console.error('Error fetching approval requests:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/approvals/:id/review - Approve, Reject or Request Info
router.post('/:id/review', authenticateToken, denyGuestMutations, requirePermission('equipment:update'), (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { action, review_notes } = req.body; // APPROVED, REJECTED, REQUEST_INFO

    if (!['APPROVED', 'REJECTED', 'REQUEST_INFO'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Hành động phê duyệt không hợp lệ' });
    }

    const requestRow = dbQueryOne(
      `SELECT tcr.*, l.loop_code as loop_id, l.name as loop_name FROM topology_change_requests tcr JOIN loops l ON tcr.loop_id = l.id WHERE tcr.id = ?`,
      [id]
    );

    if (!requestRow) {
      return res.status(404).json({ success: false, message: 'Yêu cầu phê duyệt không tồn tại' });
    }

    const username = req.user?.username || 'SYSTEM';
    const fullname = req.user?.full_name || username;

    try {
      dbRun('BEGIN TRANSACTION;');

      dbRun(
        `
        UPDATE topology_change_requests SET
          status = ?,
          reviewer_username = ?,
          reviewer_fullname = ?,
          review_notes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        [action, username, fullname, review_notes || null, id]
      );

      // Update topology version status according to review action
      if (action === 'APPROVED') {
        // Demote existing PUBLISHED versions to APPROVED
        dbRun(
          `UPDATE topology_versions SET status = 'APPROVED' WHERE loop_id = ? AND status = 'PUBLISHED'`,
          [requestRow.loop_id]
        );

        // Promote this version to PUBLISHED
        dbRun(
          `UPDATE topology_versions SET status = 'PUBLISHED', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [fullname, requestRow.version_id]
        );
      } else if (action === 'REJECTED') {
        dbRun(
          `UPDATE topology_versions SET status = 'REJECTED', rejected_by = ?, rejected_at = CURRENT_TIMESTAMP, rejection_reason = ? WHERE id = ?`,
          [fullname, review_notes || 'Không được phê duyệt', requestRow.version_id]
        );
      } else if (action === 'REQUEST_INFO') {
        dbRun(
          `UPDATE topology_versions SET status = 'REVIEW' WHERE id = ?`,
          [requestRow.version_id]
        );
      }

      dbRun('COMMIT;');
    } catch (txnErr) {
      dbRun('ROLLBACK;');
      throw txnErr;
    }

    // Notify requester
    const requesterUser = dbQueryOne(`SELECT id FROM users WHERE username = ?`, [requestRow.requester_username]);
    if (requesterUser) {
      let notifTitle = 'Kết quả Phê duyệt Sơ đồ Topology';
      let notifMsg = `Đề xuất phê duyệt sơ đồ phiên bản ${requestRow.version_str} cho khép vòng ${requestRow.loop_id} đã được ${action === 'APPROVED' ? 'Duyệt thành công' : action === 'REJECTED' ? 'Từ chối' : 'Yêu cầu bổ sung'}.`;

      dbRun(
        `INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)`,
        [
          requesterUser.id,
          notifTitle,
          notifMsg,
          action === 'APPROVED' ? 'INFO' : action === 'REJECTED' ? 'ALERT' : 'WARNING',
          `/loops/${requestRow.loop_id}`
        ]
      );
    }

    // Audit Log
    dbRun(
      `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
       VALUES (?, ?, ?, 'REVIEW_TOPOLOGY', 'KHEP_VONG', ?, ?, 'SUCCESS')`,
      [
        req.user?.id || 1,
        username,
        fullname,
        requestRow.loop_id,
        `Xử lý phê duyệt sơ đồ v${requestRow.version_str} (${action}): ${review_notes || 'Không có ghi chú'}`
      ]
    );

    res.json({
      success: true,
      message: action === 'APPROVED' ? 'Đã phê duyệt và xuất bản sơ đồ' : action === 'REJECTED' ? 'Đã từ chối yêu cầu phê duyệt' : 'Đã gửi yêu cầu bổ sung thông tin'
    });
  } catch (err: any) {
    console.error('Error reviewing topology:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
