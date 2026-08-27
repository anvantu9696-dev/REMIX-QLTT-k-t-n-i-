import { Router, Response } from 'express';
import { dbQuery, dbQueryOne, dbRun } from '../db';
import { authenticateToken, AuthenticatedRequest, requirePermission, recordAuditLog } from '../middleware';
import { generateTaskCode } from './tasks';

const router = Router();

function generateScheduleCode(): string {
  const year = new Date().getFullYear();
  let maxSeq = 0;

  try {
    const existingRows = dbQuery("SELECT schedule_code FROM inspection_schedules WHERE schedule_code IS NOT NULL");
    for (const row of existingRows) {
      const code = String(row.schedule_code || '');
      const match = code.match(/SCH(?:-\d{4})?-(\d+)/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  } catch (err) {
    console.error('Error calculating max schedule sequence:', err);
  }

  let candidateNum = maxSeq + 1;
  let candidateCode = `SCH-${year}-${String(candidateNum).padStart(3, '0')}`;

  try {
    while (dbQueryOne("SELECT id FROM inspection_schedules WHERE schedule_code = ?", [candidateCode])) {
      candidateNum++;
      candidateCode = `SCH-${year}-${String(candidateNum).padStart(3, '0')}`;
    }
  } catch (err) {
    candidateCode = `SCH-${year}-${Date.now().toString().slice(-6)}`;
  }

  return candidateCode;
}

// 1. GET /api/schedules - List schedules
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const sql = `
      SELECT s.*,
             d.device_id as device_code, d.name as device_name, d.device_type,
             c.title as checklist_title,
             u.full_name as assigned_to_fullname
      FROM inspection_schedules s
      LEFT JOIN devices d ON s.device_id = d.id
      LEFT JOIN checklists c ON s.checklist_id = c.id
      LEFT JOIN users u ON s.assigned_to_user_id = u.id
      ORDER BY s.created_at DESC
    `;
    const data = dbQuery(sql);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách lịch kiểm tra định kỳ' });
  }
});

// 2. POST /api/schedules - Create schedule
router.post('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      title,
      frequency,
      device_id,
      checklist_id,
      assigned_team,
      assigned_to_user_id,
      next_run_date
    } = req.body;

    if (!title || !frequency || !device_id || !checklist_id) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn Tên lịch, Tần suất, Thiết bị và Checklist' });
    }

    const code = generateScheduleCode();
    const nextDate = next_run_date || new Date().toISOString().split('T')[0] + ' 08:00:00';

    dbRun(
      `INSERT INTO inspection_schedules (
        schedule_code, title, frequency, device_id, checklist_id, assigned_team, assigned_to_user_id, next_run_date, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [
        code,
        title,
        frequency,
        device_id,
        checklist_id,
        assigned_team || req.user?.team || 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
        assigned_to_user_id || null,
        nextDate,
        req.user?.username || 'SYSTEM'
      ]
    );

    const newSchedule = dbQueryOne("SELECT * FROM inspection_schedules WHERE schedule_code = ?", [code]);

    res.json({ success: true, message: 'Tạo lịch kiểm tra định kỳ thành công', data: newSchedule });
  } catch (error: any) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lập lịch kiểm tra định kỳ' });
  }
});

// 3. POST /api/schedules/generate-tasks - Trigger system to create tasks from schedules due
router.post('/generate-tasks', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const dueSchedules = dbQuery(
      `SELECT s.*, d.name as device_name, c.title as checklist_title, u.username as assigned_username, u.full_name as assigned_fullname
       FROM inspection_schedules s
       LEFT JOIN devices d ON s.device_id = d.id
       LEFT JOIN checklists c ON s.checklist_id = c.id
       LEFT JOIN users u ON s.assigned_to_user_id = u.id
       WHERE s.status = 'ACTIVE' AND s.next_run_date <= ?`,
      [nowStr]
    );

    let generatedCount = 0;

    for (const sch of dueSchedules) {
      const taskCode = generateTaskCode(0);

      // Calculate due date (default +1 day)
      const dueDateObj = new Date();
      dueDateObj.setDate(dueDateObj.getDate() + 1);
      const dueDateStr = dueDateObj.toISOString().replace('T', ' ').substring(0, 19);

      dbRun(
        `INSERT INTO tasks (
          task_code, title, device_id, assigned_to_user_id, assigned_to_username, assigned_to_fullname,
          team, checklist_id, assigned_date, due_date, priority, status, content, notes, created_by, inspection_schedule_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 'MEDIUM', 'ASSIGNED', ?, ?, 'SYSTEM_SCHEDULER', ?)`,
        [
          taskCode,
          `Kiểm tra định kỳ (${sch.frequency}): ${sch.title}`,
          sch.device_id,
          sch.assigned_to_user_id || null,
          sch.assigned_username || null,
          sch.assigned_fullname || null,
          sch.assigned_team,
          sch.checklist_id,
          dueDateStr,
          `Tự động tạo từ lịch kiểm tra định kỳ ${sch.schedule_code}`,
          `Thực hiện kiểm tra thiết bị theo mẫu ${sch.checklist_title}`,
          sch.id
        ]
      );

      // Compute next run date based on frequency
      const nextDate = new Date();
      switch (sch.frequency) {
        case 'DAILY': nextDate.setDate(nextDate.getDate() + 1); break;
        case 'WEEKLY': nextDate.setDate(nextDate.getDate() + 7); break;
        case 'MONTHLY': nextDate.setMonth(nextDate.getMonth() + 1); break;
        case 'QUARTERLY': nextDate.setMonth(nextDate.getMonth() + 3); break;
        case 'HALF_YEARLY': nextDate.setMonth(nextDate.getMonth() + 6); break;
        case 'YEARLY': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
        default: nextDate.setMonth(nextDate.getMonth() + 1); break;
      }
      const nextRunStr = nextDate.toISOString().replace('T', ' ').substring(0, 19);

      dbRun(
        `UPDATE inspection_schedules SET last_run_date = CURRENT_TIMESTAMP, next_run_date = ? WHERE id = ?`,
        [nextRunStr, sch.id]
      );

      generatedCount++;
    }

    res.json({
      success: true,
      message: `Đã sinh tự động ${generatedCount} công việc kiểm tra từ lịch định kỳ`,
      generated_count: generatedCount
    });
  } catch (error: any) {
    console.error('Error generating schedule tasks:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tự động tạo công việc từ lịch định kỳ' });
  }
});

// 4. DELETE /api/schedules/:id - Soft delete
router.delete('/:id', authenticateToken, requirePermission('PERIODIC_INSPECTION_DELETE'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { reason } = req.body;

    const schedule = dbQueryOne("SELECT * FROM inspection_schedules WHERE id = ?", [id]);
    if (!schedule) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch kiểm tra' });

    // Check for associated tasks
    const tasks = dbQuery("SELECT id FROM tasks WHERE inspection_schedule_id = ?", [id]);
    if (tasks.length > 0) {
        // Just a warning, still allow deletion if Admin or with permission
    }

    dbRun(
        "UPDATE inspection_schedules SET status = 'DELETED', deleted_at = CURRENT_TIMESTAMP, deleted_by = ?, deleted_reason = ? WHERE id = ?",
        [req.user?.full_name || 'SYSTEM', reason || 'Không có lý do', id]
    );

    recordAuditLog({
        user_id: req.user!.id,
        username: req.user!.username,
        user_fullname: req.user!.full_name,
        action: 'DELETE',
        module: 'KIEM_TRA_DINH_KY',
        target_id: id,
        details: `Xóa lịch kiểm tra định kỳ ${schedule.schedule_code}. Lý do: ${reason || 'Không có lý do'}`,
        result: 'SUCCESS'
    });

    res.json({ success: true, message: 'Xóa lịch kiểm tra định kỳ thành công' });
  } catch (error: any) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa lịch định kỳ' });
  }
});

// 5. POST /api/schedules/:id/restore - Restore soft-deleted schedule
router.post('/:id/restore', authenticateToken, requirePermission('PERIODIC_INSPECTION_DELETE'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
  
      dbRun(
          "UPDATE inspection_schedules SET status = 'ACTIVE', deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL WHERE id = ?",
          [id]
      );
  
      recordAuditLog({
          user_id: req.user!.id,
          username: req.user!.username,
          user_fullname: req.user!.full_name,
          action: 'RESTORE',
          module: 'KIEM_TRA_DINH_KY',
          target_id: id,
          details: `Khôi phục lịch kiểm tra định kỳ id: ${id}`,
          result: 'SUCCESS'
      });
  
      res.json({ success: true, message: 'Khôi phục lịch kiểm tra định kỳ thành công' });
    } catch (error: any) {
      console.error('Error restoring schedule:', error);
      res.status(500).json({ success: false, message: 'Lỗi khi khôi phục lịch định kỳ' });
    }
  });

export default router;
