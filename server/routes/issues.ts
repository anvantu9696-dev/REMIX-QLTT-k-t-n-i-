import { Router, Response } from 'express';
import { dbQuery, dbQueryOne, dbRun } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware';
import { broadcastRealtimeEvent } from '../events';

const router = Router();

function generateIssueCode(): string {
  const countRow = dbQueryOne("SELECT COUNT(*) as count FROM issues");
  const nextNum = (countRow?.count || 0) + 1;
  return `ISS-${new Date().getFullYear()}-${String(nextNum).padStart(3, '0')}`;
}

// 1. GET /api/issues - List issues
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, status, severity, device_id } = req.query;

    let sql = `
      SELECT i.*,
             d.device_id as device_code, d.name as device_name, d.device_type, d.pole_number,
             s.name as substation_name, f.name as feeder_name
      FROM issues i
      LEFT JOIN devices d ON i.device_id = d.id
      LEFT JOIN substations s ON d.substation_id = s.id
      LEFT JOIN feeders f ON d.feeder_id = f.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      sql += ` AND (i.issue_code LIKE ? OR i.title LIKE ? OR i.content LIKE ? OR d.name LIKE ? OR d.device_id LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    if (status) {
      sql += ` AND i.status = ?`;
      params.push(status);
    }

    if (severity) {
      sql += ` AND i.severity = ?`;
      params.push(severity);
    }

    if (device_id) {
      sql += ` AND i.device_id = ?`;
      params.push(device_id);
    }

    sql += ` ORDER BY 
      CASE i.severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
      END,
      i.reported_at DESC
    `;

    const issues = dbQuery(sql, params);
    res.json({ success: true, data: issues, total: issues.length });
  } catch (error: any) {
    console.error('Error fetching issues:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách bất thường' });
  }
});

// 2. GET /api/issues/:id - Detail
router.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const issue = dbQueryOne(
      `SELECT i.*,
              d.device_id as device_code, d.name as device_name, d.device_type, d.pole_number, d.unit as device_unit, d.team as device_team, d.latitude, d.longitude,
              s.name as substation_name, f.name as feeder_name
       FROM issues i
       LEFT JOIN devices d ON i.device_id = d.id
       LEFT JOIN substations s ON d.substation_id = s.id
       LEFT JOIN feeders f ON d.feeder_id = f.id
       WHERE i.id = ?`,
      [id]
    );

    if (!issue) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin bất thường' });
    }

    res.json({ success: true, data: issue });
  } catch (error: any) {
    console.error('Error fetching issue detail:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi lấy chi tiết bất thường' });
  }
});

// 3. POST /api/issues - Report new issue (BÁO BẤT THƯỜNG)
router.post('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      device_id,
      title,
      content,
      severity,
      image_url,
      notes
    } = req.body;

    if (!device_id || !title || !content || !severity) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn Thiết bị, Tên bất thường, Nội dung và Mức độ nghiêm trọng' });
    }

    const code = generateIssueCode();

    dbRun(
      `INSERT INTO issues (
        issue_code, device_id, title, content, severity, status, image_url,
        reported_by_username, reported_by_fullname, notes
      ) VALUES (?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?)`,
      [
        code,
        device_id,
        title,
        content,
        severity,
        image_url || '',
        req.user?.username || 'SYSTEM',
        req.user?.full_name || 'Hệ thống',
        notes || ''
      ]
    );

    const newIssue = dbQueryOne("SELECT * FROM issues WHERE issue_code = ?", [code]);

    // Audit Log
    dbRun(
      `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
       VALUES (?, ?, ?, 'BAO_BAT_THUONG', 'BAT_THUONG', ?, ?, 'SUCCESS')`,
      [
        req.user?.id || 1,
        req.user?.username || 'SYSTEM',
        req.user?.full_name || 'Hệ thống',
        code,
        `Báo bất thường "${title}" mức độ ${severity} trên thiết bị ID #${device_id}`
      ]
    );

    // If HIGH or CRITICAL, send alert notifications to managers/leads
    if (['HIGH', 'CRITICAL'].includes(severity)) {
      const managers = dbQuery(
        `SELECT DISTINCT u.id FROM users u
         JOIN user_roles ur ON u.id = ur.user_id
         JOIN roles r ON ur.role_id = r.id
         WHERE r.code IN ('ADMIN', 'DOI_TRUONG', 'TRUONG_CA')`
      );

      for (const m of managers) {
        dbRun(
          `INSERT INTO notifications (user_id, title, message, type, link)
           VALUES (?, ?, ?, 'ALERT', ?)`,
          [
            m.id,
            `CẢNH BÁO BẤT THƯỜNG [${severity}]: ${code}`,
            `Phát hiện bất thường nghiêm trọng "${title}" tại thiết bị. Vui lòng phân công xử lý khẩn cấp.`,
            `/issues?id=${newIssue.id}`
          ]
        );
      }
    }

    broadcastRealtimeEvent({
      type: 'CREATE',
      entity: 'ISSUE',
      action: 'CREATE',
      id: newIssue.id,
      data: { title: newIssue.title, severity: newIssue.severity }
    });

    res.json({ success: true, message: 'Ghi nhận báo bất thường thành công', data: newIssue });
  } catch (error: any) {
    console.error('Error reporting issue:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi báo bất thường' });
  }
});

// 4. PUT /api/issues/:id/status - Update issue status (NEW -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED)
router.put('/:id/status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, assigned_to_username, resolution_notes } = req.body;

    const issue = dbQueryOne("SELECT * FROM issues WHERE id = ?", [id]);
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin bất thường' });
    }

    let assignedFullname = issue.assigned_to_fullname;
    if (assigned_to_username) {
      const u = dbQueryOne("SELECT full_name FROM users WHERE username = ?", [assigned_to_username]);
      if (u) assignedFullname = u.full_name;
    }

    const isResolved = status === 'RESOLVED';
    const isClosed = status === 'CLOSED';

    dbRun(
      `UPDATE issues SET
        status = ?,
        assigned_to_username = COALESCE(?, assigned_to_username),
        assigned_to_fullname = COALESCE(?, assigned_to_fullname),
        resolution_notes = CASE WHEN ? != '' THEN ? ELSE resolution_notes END,
        resolved_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE resolved_at END,
        closed_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE closed_at END,
        closed_by = CASE WHEN ? THEN ? ELSE closed_by END
       WHERE id = ?`,
      [
        status,
        assigned_to_username || null,
        assignedFullname || null,
        resolution_notes || '',
        resolution_notes || '',
        isResolved ? 1 : 0,
        isClosed ? 1 : 0,
        isClosed ? 1 : 0,
        req.user?.username || 'SYSTEM',
        id
      ]
    );

    // Audit log
    const auditAction = isClosed ? 'DONG_BAT_THUONG' : 'CAP_NHAT_BAT_THUONG';
    dbRun(
      `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
       VALUES (?, ?, ?, ?, 'BAT_THUONG', ?, ?, 'SUCCESS')`,
      [
        req.user?.id || 1,
        req.user?.username || 'SYSTEM',
        req.user?.full_name || 'Hệ thống',
        auditAction,
        issue.issue_code,
        `Chuyển trạng thái xử lý bất thường "${issue.title}" sang ${status}`
      ]
    );

    broadcastRealtimeEvent({
      type: 'UPDATE',
      entity: 'ISSUE',
      action: 'STATUS',
      id: id,
      data: { title: issue.title, status }
    });

    res.json({ success: true, message: 'Cập nhật trạng thái xử lý bất thường thành công' });
  } catch (error: any) {
    console.error('Error updating issue status:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái bất thường' });
  }
});

// 5. DELETE /api/issues/:id
router.delete('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    dbRun("DELETE FROM issues WHERE id = ?", [id]);

    broadcastRealtimeEvent({
      type: 'DELETE',
      entity: 'ISSUE',
      action: 'DELETE',
      id: id
    });

    res.json({ success: true, message: 'Xóa bất thường thành công' });
  } catch (error: any) {
    console.error('Error deleting issue:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa thông tin bất thường' });
  }
});

export default router;
