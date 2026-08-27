import { Router, Response } from 'express';
import { dbQuery, dbQueryOne, dbRun } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware';
import { broadcastRealtimeEvent } from '../events';

const router = Router();

// Helper to generate unique, collision-proof task code
export function generateTaskCode(offset: number = 0): string {
  const year = new Date().getFullYear();
  let maxSeq = 0;

  try {
    const existingRows = dbQuery("SELECT task_code FROM tasks WHERE task_code IS NOT NULL");
    for (const row of existingRows) {
      const code = String(row.task_code || '');
      const match = code.match(/TASK(?:-\d{4})?-(\d+)/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  } catch (err) {
    console.error('Error calculating max task code sequence:', err);
  }

  let candidateNum = Math.max(maxSeq + 1 + offset, 1);
  let candidateCode = `TASK-${year}-${String(candidateNum).padStart(3, '0')}`;

  // Extra safety check: if candidateCode already exists in tasks table, increment until unique
  try {
    while (dbQueryOne("SELECT id FROM tasks WHERE task_code = ?", [candidateCode])) {
      candidateNum++;
      candidateCode = `TASK-${year}-${String(candidateNum).padStart(3, '0')}`;
    }
  } catch (err) {
    // If query fails, fall back to timestamp suffix to guarantee uniqueness
    candidateCode = `TASK-${year}-${Date.now().toString().slice(-6)}`;
  }

  return candidateCode;
}

// Helper: Record Task History
function recordTaskHistory(
  taskId: number,
  user: any,
  action: string,
  actionLabel: string,
  oldStatus?: string | null,
  newStatus?: string | null,
  progress?: number | null,
  notes?: string | null
) {
  try {
    dbRun(
      `INSERT INTO task_histories (
        task_id, user_id, username, user_fullname, action, action_label, old_status, new_status, progress, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        user?.id || null,
        user?.username || 'SYSTEM',
        user?.full_name || user?.username || 'Hệ thống',
        action,
        actionLabel,
        oldStatus || null,
        newStatus || null,
        progress !== undefined && progress !== null ? progress : null,
        notes || null
      ]
    );
  } catch (err) {
    console.error('Error recording task history:', err);
  }
}

// Helper: Send Task Notification
function sendTaskNotification(
  userId: number | null | undefined,
  title: string,
  message: string,
  taskId: number,
  type: 'INFO' | 'WARNING' | 'ALERT' = 'INFO'
) {
  if (!userId) return;
  try {
    dbRun(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, title, message, type, `/tasks?id=${taskId}`]
    );
  } catch (err) {
    console.error('Error sending task notification:', err);
  }
}

// Helper: Check if authenticated user is the assigned person
function isTaskAssignee(task: any, user: any): boolean {
  if (!user) return false;
  if (task.assigned_to_user_id && Number(task.assigned_to_user_id) === Number(user.id)) return true;
  if (task.assigned_to_username && task.assigned_to_username.toLowerCase() === String(user.username).toLowerCase()) return true;
  if (task.assigned_to_fullname && user.full_name && task.assigned_to_fullname.toLowerCase() === user.full_name.toLowerCase()) return true;
  return false;
}

// Helper: Check if authenticated user is the task creator
function isTaskCreator(task: any, user: any): boolean {
  if (!user) return false;
  if (task.creator_id && Number(task.creator_id) === Number(user.id)) return true;
  if (task.creator_username && task.creator_username.toLowerCase() === String(user.username).toLowerCase()) return true;
  if (task.created_by && task.created_by.toLowerCase() === String(user.username).toLowerCase()) return true;
  return false;
}

// Helper: Check if authenticated user is "Cán bộ phương thức" or "ADMIN"
function isCanBoPhuongThucOrAdmin(user: any): boolean {
  if (!user) return false;
  const roles: string[] = user.roles || [];
  return roles.some((r: string) => {
    const code = String(r).toUpperCase();
    return (
      code === 'CAN_BO_PHUONG_THUC' ||
      code === 'ADMIN' ||
      code.includes('PHUONG_THUC') ||
      code.includes('QUAN_TRI') ||
      code.includes('CÁN BỘ PHƯƠNG THỨC') ||
      code.includes('QUẢN TRỊ')
    );
  });
}

// Helper: Check if authenticated user has Manager / Admin / Approval permission
function isManagerOrAdmin(user: any): boolean {
  if (!user) return false;
  const roles = user.roles || [];
  const perms = user.permissions || [];
  return (
    isCanBoPhuongThucOrAdmin(user) ||
    roles.some((r: string) => ['ADMIN', 'LÃNH ĐẠO', 'ĐỘI TRƯỞNG', 'QUẢN_LÝ', 'DIEU_DO'].includes(r)) ||
    perms.includes('tasks:approve') ||
    perms.includes('tasks:create') ||
    perms.includes('tasks:manage')
  );
}

// 1. GET /api/tasks - List all tasks with filter
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, status, priority, device_id, team, assigned_to, archived } = req.query;

    let sql = `
      SELECT t.*,
             d.device_id as device_code, d.name as device_name, d.device_type, d.pole_number,
             c.title as checklist_title, c.category as checklist_category
      FROM tasks t
      LEFT JOIN devices d ON t.device_id = d.id
      LEFT JOIN checklists c ON t.checklist_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      sql += ` AND (t.task_code LIKE ? OR t.title LIKE ? OR t.content LIKE ? OR d.name LIKE ? OR d.device_id LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    if (status) {
      sql += ` AND t.status = ?`;
      params.push(status);
    }

    if (priority) {
      sql += ` AND t.priority = ?`;
      params.push(priority);
    }

    if (device_id) {
      sql += ` AND t.device_id = ?`;
      params.push(device_id);
    }

    if (team) {
      sql += ` AND t.team = ?`;
      params.push(team);
    }

    if (assigned_to) {
      sql += ` AND (t.assigned_to_user_id = ? OR t.assigned_to_username = ? OR t.assigned_to_fullname = ?)`;
      params.push(assigned_to, assigned_to, assigned_to);
    }
    
    // Permission filter
    if (!isManagerOrAdmin(req.user)) {
      sql += ` AND t.assigned_to_user_id = ?`;
      params.push(req.user.id);
    }

    // 30-Day Archival Filtering
    if (archived === 'only' || archived === 'true') {
      sql += ` AND t.status = 'COMPLETED' AND datetime(COALESCE(t.completed_at, t.approved_at, t.updated_at, t.created_at)) <= datetime('now', '-30 days')`;
    } else if (archived === 'false' || archived === 'active') {
      sql += ` AND NOT (t.status = 'COMPLETED' AND datetime(COALESCE(t.completed_at, t.approved_at, t.updated_at, t.created_at)) <= datetime('now', '-30 days'))`;
    }

    sql += ` ORDER BY 
      CASE t.status
        WHEN 'PENDING_APPROVAL' THEN 1
        WHEN 'IN_PROGRESS' THEN 2
        WHEN 'ASSIGNED' THEN 3
        WHEN 'ACCEPTED' THEN 4
        WHEN 'OVERDUE' THEN 5
        WHEN 'RETURNED' THEN 6
        WHEN 'PAUSED' THEN 7
        WHEN 'COMPLETED' THEN 8
        WHEN 'CANCELLED' THEN 9
        ELSE 10
      END,
      t.due_date ASC, t.created_at DESC`;

    const rawTasks = dbQuery(sql, params);

    // Auto update status OVERDUE for tasks where due_date < now and status NOT IN ('COMPLETED', 'CANCELLED', 'OVERDUE', 'PENDING_APPROVAL')
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    dbRun(
      `UPDATE tasks SET status = 'OVERDUE'
       WHERE due_date < ? AND status NOT IN ('COMPLETED', 'CANCELLED', 'OVERDUE', 'PENDING_APPROVAL')`,
      [nowStr]
    );

    const now = new Date();
    const tasks = rawTasks.map((t: any) => {
      let isArchived = false;
      let daysSinceCompleted: number | undefined = undefined;
      if (t.status === 'COMPLETED') {
        const compDateStr = t.completed_at || t.approved_at || t.updated_at || t.created_at;
        if (compDateStr) {
          const compTime = new Date(String(compDateStr).replace(' ', 'T')).getTime();
          if (!isNaN(compTime)) {
            const diffMs = now.getTime() - compTime;
            daysSinceCompleted = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
            if (daysSinceCompleted >= 30) {
              isArchived = true;
            }
          }
        }
      }
      return {
        ...t,
        is_archived: isArchived,
        days_since_completed: daysSinceCompleted
      };
    });

    const totalArchivedRow = dbQueryOne(`
      SELECT COUNT(*) as count FROM tasks
      WHERE status = 'COMPLETED' AND datetime(COALESCE(completed_at, approved_at, updated_at, created_at)) <= datetime('now', '-30 days')
    `);

    res.json({
      success: true,
      data: tasks,
      total: tasks.length,
      archived_count: totalArchivedRow ? (totalArchivedRow.count as number) : 0
    });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi lấy danh sách công việc' });
  }
});

// 2. GET /api/tasks/my-tasks - Employee screen "CÔNG VIỆC CỦA TÔI"
// Strictly returns tasks assigned to the currently authenticated user
// Automatically archives 'Hoàn tất' tasks older than 30 days to keep the active list focused!
router.get('/my-tasks', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const username = req.user?.username;
    const userFullName = req.user?.full_name;
    const { search, status, priority, archived } = req.query;

    let sql = `
      SELECT t.*,
             d.device_id as device_code, d.name as device_name, d.device_type, d.pole_number, d.latitude, d.longitude,
             c.title as checklist_title, c.category as checklist_category
      FROM tasks t
      LEFT JOIN devices d ON t.device_id = d.id
      LEFT JOIN checklists c ON t.checklist_id = c.id
      WHERE (t.assigned_to_user_id = ? OR t.assigned_to_username = ? ${userFullName ? 'OR t.assigned_to_fullname = ?' : ''})
    `;
    const params: any[] = userFullName ? [userId, username, userFullName] : [userId, username];

    if (search) {
      sql += ` AND (t.task_code LIKE ? OR t.title LIKE ? OR t.content LIKE ? OR d.name LIKE ? OR d.device_id LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    if (status) {
      sql += ` AND t.status = ?`;
      params.push(status);
    }

    if (priority) {
      sql += ` AND t.priority = ?`;
      params.push(priority);
    }

    // 30-Day Auto Archive Handling for "Công việc của tôi":
    if (archived === 'only' || archived === 'true') {
      // Only return archived tasks (COMPLETED and completed >30 days ago)
      sql += ` AND t.status = 'COMPLETED' AND datetime(COALESCE(t.completed_at, t.approved_at, t.updated_at, t.created_at)) <= datetime('now', '-30 days')`;
    } else if (archived === 'all') {
      // Return both active and archived
    } else {
      // Default: Keep active list focused on active tasks by hiding completed tasks older than 30 days
      if (!status || status !== 'COMPLETED') {
        sql += ` AND NOT (t.status = 'COMPLETED' AND datetime(COALESCE(t.completed_at, t.approved_at, t.updated_at, t.created_at)) <= datetime('now', '-30 days'))`;
      }
    }

    sql += ` ORDER BY 
      CASE t.status
        WHEN 'IN_PROGRESS' THEN 1
        WHEN 'ASSIGNED' THEN 2
        WHEN 'ACCEPTED' THEN 3
        WHEN 'PENDING_APPROVAL' THEN 4
        WHEN 'OVERDUE' THEN 5
        WHEN 'RETURNED' THEN 6
        WHEN 'PAUSED' THEN 7
        WHEN 'COMPLETED' THEN 8
        WHEN 'CANCELLED' THEN 9
        ELSE 10
      END,
      t.due_date ASC`;

    const rawTasks = dbQuery(sql, params);

    const now = new Date();
    const tasks = rawTasks.map((t: any) => {
      let isArchived = false;
      let daysSinceCompleted: number | undefined = undefined;
      if (t.status === 'COMPLETED') {
        const compDateStr = t.completed_at || t.approved_at || t.updated_at || t.created_at;
        if (compDateStr) {
          const compTime = new Date(String(compDateStr).replace(' ', 'T')).getTime();
          if (!isNaN(compTime)) {
            const diffMs = now.getTime() - compTime;
            daysSinceCompleted = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
            if (daysSinceCompleted >= 30) {
              isArchived = true;
            }
          }
        }
      }
      return {
        ...t,
        is_archived: isArchived,
        days_since_completed: daysSinceCompleted
      };
    });

    // Count user's archived tasks
    const countSql = `
      SELECT COUNT(*) as count FROM tasks
      WHERE (assigned_to_user_id = ? OR assigned_to_username = ? ${userFullName ? 'OR assigned_to_fullname = ?' : ''})
        AND status = 'COMPLETED'
        AND datetime(COALESCE(completed_at, approved_at, updated_at, created_at)) <= datetime('now', '-30 days')
    `;
    const countParams = userFullName ? [userId, username, userFullName] : [userId, username];
    const archivedCountRow = dbQueryOne(countSql, countParams);

    res.json({
      success: true,
      data: tasks,
      total: tasks.length,
      archived_count: archivedCountRow ? (archivedCountRow.count as number) : 0
    });
  } catch (error: any) {
    console.error('Error fetching my tasks:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi lấy danh sách công việc cá nhân' });
  }
});

// 3. GET /api/tasks/:id - Task details with checklist items, results, history, and user permissions
router.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const task = dbQueryOne(
      `SELECT t.*,
              d.device_id as device_code, d.name as device_name, d.device_type, d.pole_number, d.unit as device_unit, d.team as device_team, d.latitude, d.longitude, d.google_maps_url,
              c.title as checklist_title, c.category as checklist_category, c.version as checklist_version
       FROM tasks t
       LEFT JOIN devices d ON t.device_id = d.id
       LEFT JOIN checklists c ON t.checklist_id = c.id
       WHERE t.id = ?`,
      [taskId]
    );

    if (!task) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
    }

    // Permission flags for current user
    const isAssignee = isTaskAssignee(task, req.user);
    const isCreator = isTaskCreator(task, req.user);
    const isSupervisor = isManagerOrAdmin(req.user);

    // Fetch checklist items if checklist assigned
    let checklistItems: any[] = [];
    if (task.checklist_id) {
      checklistItems = dbQuery(
        `SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY item_order ASC`,
        [task.checklist_id]
      );
    }

    // Fetch submitted results if any
    const results = dbQuery(
      `SELECT * FROM task_checklist_results WHERE task_id = ? ORDER BY checklist_item_id ASC`,
      [taskId]
    );

    // Fetch task history logs
    const history = dbQuery(
      `SELECT * FROM task_histories WHERE task_id = ? ORDER BY created_at ASC`,
      [taskId]
    );

    res.json({
      success: true,
      data: {
        ...task,
        checklist_items: checklistItems,
        results: results,
        history: history,
        permissions: {
          is_assignee: isAssignee,
          is_creator: isCreator,
          is_supervisor: isSupervisor,
          can_execute: isAssignee, // Only assignee can accept, start, update progress, submit completion
          can_create: isCanBoPhuongThucOrAdmin(req.user),
          can_approve: isCanBoPhuongThucOrAdmin(req.user), // Strictly CAN_BO_PHUONG_THUC or ADMIN can approve/confirm
          can_cancel: isCanBoPhuongThucOrAdmin(req.user) || isCreator
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching task detail:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy chi tiết công việc' });
  }
});

// 4. POST /api/tasks - Create new task (GIAO VIỆC)
// STRICT RULE: Only "CAN_BO_PHUONG_THUC" or "ADMIN" can create/assign tasks!
router.post('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isCanBoPhuongThucOrAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Chỉ tài khoản có phân quyền “Cán bộ phương thức” hoặc “Quản trị hệ thống (Admin)” mới được phép truy cập và sử dụng chức năng Giao việc mới.'
      });
    }

    const {
      title,
      device_id,
      device_ids,
      assigned_to_user_id,
      team,
      checklist_id,
      assigned_date,
      due_date,
      priority,
      content,
      notes
    } = req.body;

    if (!title || !content || !due_date) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ Tên công việc, Nội dung và Hạn hoàn thành' });
    }

    // Get assigned user info
    let assignedUsername = null;
    let assignedFullname = null;
    if (assigned_to_user_id) {
      const u = dbQueryOne("SELECT username, full_name FROM users WHERE id = ?", [assigned_to_user_id]);
      if (u) {
        assignedUsername = u.username;
        assignedFullname = u.full_name;
      }
    }

    const assignedDateVal = assigned_date || new Date().toISOString().replace('T', ' ').substring(0, 19);
    const creatorId = req.user?.id || null;
    const creatorUsername = req.user?.username || 'SYSTEM';
    const creatorFullname = req.user?.full_name || req.user?.username || 'Hệ thống';

    // Case 1: Multiple devices selected for batch assignment
    if (Array.isArray(device_ids) && device_ids.length > 0) {
      const createdTasks: any[] = [];

      for (let i = 0; i < device_ids.length; i++) {
        const devId = parseInt(device_ids[i], 10);
        const dev = dbQueryOne("SELECT id, device_id, name, device_type, pole_number FROM devices WHERE id = ?", [devId]);
        const taskCode = generateTaskCode(i);
        
        const specificTitle = device_ids.length > 1 && dev 
          ? `${title} - [${dev.device_id || dev.name}]`
          : title;

        dbRun(
          `INSERT INTO tasks (
            task_code, title, device_id, assigned_to_user_id, assigned_to_username, assigned_to_fullname,
            team, checklist_id, assigned_date, due_date, priority, status, progress, content, notes,
            created_by, creator_id, creator_username, creator_fullname
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ASSIGNED', 0, ?, ?, ?, ?, ?, ?)`,
          [
            taskCode,
            specificTitle,
            devId,
            assigned_to_user_id || null,
            assignedUsername,
            assignedFullname,
            team || req.user?.team || 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
            checklist_id || null,
            assignedDateVal,
            due_date,
            priority || 'MEDIUM',
            content,
            notes || '',
            creatorUsername,
            creatorId,
            creatorUsername,
            creatorFullname
          ]
        );

        const newTask = dbQueryOne("SELECT * FROM tasks WHERE task_code = ?", [taskCode]);
        if (newTask) {
          createdTasks.push(newTask);
          // Record history log
          recordTaskHistory(
            newTask.id,
            req.user,
            'GIAO_VIEC',
            'Giao công việc',
            null,
            'ASSIGNED',
            0,
            `Giao việc cho nhân viên: ${assignedFullname || 'Chưa gán'}`
          );

          broadcastRealtimeEvent({
            type: 'CREATE',
            entity: 'TASK',
            action: 'CREATE',
            id: newTask.id,
            data: { title: newTask.title, task_code: newTask.task_code, assigned_to: assignedFullname }
          });
        }
      }

      // Send consolidated Notification to assigned user
      if (assigned_to_user_id && createdTasks.length > 0) {
        sendTaskNotification(
          assigned_to_user_id,
          `Phân công ${createdTasks.length} công việc mới`,
          `Bạn được ${creatorFullname} phân công ${createdTasks.length} công việc cho các thiết bị: "${title}". Hạn hoàn thành: ${due_date}.`,
          createdTasks[0].id,
          'INFO'
        );
      }

      // Record Audit Log
      dbRun(
        `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
         VALUES (?, ?, ?, 'GIAO_VIEC_HANG_LOAT', 'CONG_VIEC', ?, ?, 'SUCCESS')`,
        [
          creatorId || 1,
          creatorUsername,
          creatorFullname,
          createdTasks[0]?.task_code || 'BATCH',
          `Giao ${createdTasks.length} công việc "${title}" cho nhân viên ${assignedFullname || 'Chưa gán'}`
        ]
      );

      return res.json({
        success: true,
        message: `Đã giao thành công ${createdTasks.length} công việc cho nhân viên ${assignedFullname || 'được chọn'}`,
        count: createdTasks.length,
        data: createdTasks
      });
    }

    // Case 2: Single device or general task
    const taskCode = generateTaskCode(0);

    dbRun(
      `INSERT INTO tasks (
        task_code, title, device_id, assigned_to_user_id, assigned_to_username, assigned_to_fullname,
        team, checklist_id, assigned_date, due_date, priority, status, progress, content, notes,
        created_by, creator_id, creator_username, creator_fullname
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ASSIGNED', 0, ?, ?, ?, ?, ?, ?)`,
      [
        taskCode,
        title,
        device_id || null,
        assigned_to_user_id || null,
        assignedUsername,
        assignedFullname,
        team || req.user?.team || 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
        checklist_id || null,
        assignedDateVal,
        due_date,
        priority || 'MEDIUM',
        content,
        notes || '',
        creatorUsername,
        creatorId,
        creatorUsername,
        creatorFullname
      ]
    );

    const newTask = dbQueryOne("SELECT * FROM tasks WHERE task_code = ?", [taskCode]);

    if (newTask) {
      recordTaskHistory(
        newTask.id,
        req.user,
        'GIAO_VIEC',
        'Giao công việc',
        null,
        'ASSIGNED',
        0,
        `Giao việc cho nhân viên: ${assignedFullname || 'Chưa gán'}`
      );
    }

    // Send Notification to assigned user
    if (assigned_to_user_id && newTask) {
      sendTaskNotification(
        assigned_to_user_id,
        `Phân công công việc mới: ${taskCode}`,
        `Bạn được ${creatorFullname} phân công công việc "${title}". Hạn hoàn thành: ${due_date}.`,
        newTask.id,
        'INFO'
      );
    }

    // Record Audit Log
    dbRun(
      `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
       VALUES (?, ?, ?, 'GIAO_VIEC', 'CONG_VIEC', ?, ?, 'SUCCESS')`,
      [
        creatorId || 1,
        creatorUsername,
        creatorFullname,
        taskCode,
        `Giao công việc "${title}" cho nhân viên ${assignedFullname || 'Chưa gán'}`
      ]
    );

    res.json({ success: true, message: 'Tạo và giao công việc thành công', data: newTask });
  } catch (error: any) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tạo công việc mới' });
  }
});

// 5. POST /api/tasks/:id/accept - Employee accepts assigned task (NHẬN VIỆC)
// BACKEND SECURITY RULE: ONLY the assigned account can accept!
router.post('/:id/accept', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { notes } = req.body || {};

    const task = dbQueryOne("SELECT * FROM tasks WHERE id = ?", [taskId]);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
    }

    // MANDATORY 403 CHECK
    if (!isTaskAssignee(task, req.user)) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Bạn không có quyền nhận công việc này! Theo nguyên tắc “giao cho ai – chỉ người đó được thực hiện”, chỉ tài khoản được chỉ định mới có thể nhận việc.'
      });
    }

    const oldStatus = task.status;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    dbRun(
      `UPDATE tasks SET
        status = 'ACCEPTED',
        accepted_at = COALESCE(accepted_at, ?),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nowStr, taskId]
    );

    // Record history
    recordTaskHistory(
      taskId,
      req.user,
      'NHAN_VIEC',
      'Đã nhận việc',
      oldStatus,
      'ACCEPTED',
      task.progress || 0,
      notes || 'Nhân viên đã xác nhận tiếp nhận công việc'
    );

    // Notify creator
    if (task.creator_id) {
      sendTaskNotification(
        task.creator_id,
        `Công việc đã được tiếp nhận: ${task.task_code}`,
        `Nhân viên ${req.user?.full_name || req.user?.username} đã tiếp nhận công việc "${task.title}".`,
        taskId,
        'INFO'
      );
    }

    res.json({ success: true, message: 'Đã tiếp nhận công việc thành công' });
  } catch (error: any) {
    console.error('Error accepting task:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tiếp nhận công việc' });
  }
});

// 6. POST /api/tasks/:id/start - Employee starts execution (BẮT ĐẦU THỰC HIỆN)
// BACKEND SECURITY RULE: ONLY the assigned account can start!
router.post('/:id/start', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { notes } = req.body || {};

    const task = dbQueryOne("SELECT * FROM tasks WHERE id = ?", [taskId]);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
    }

    // MANDATORY 403 CHECK
    if (!isTaskAssignee(task, req.user)) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Bạn không có quyền bắt đầu công việc này! Chỉ tài khoản được giao mới có thể bắt đầu thi công/kiểm tra.'
      });
    }

    const oldStatus = task.status;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newProgress = Math.max(task.progress || 0, 10);

    dbRun(
      `UPDATE tasks SET
        status = 'IN_PROGRESS',
        started_at = COALESCE(started_at, ?),
        progress = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nowStr, newProgress, taskId]
    );

    // Record history
    recordTaskHistory(
      taskId,
      req.user,
      'BAT_DAU',
      'Bắt đầu thực hiện',
      oldStatus,
      'IN_PROGRESS',
      newProgress,
      notes || 'Nhân viên bắt đầu triển khai công việc tại hiện trường'
    );

    // Notify creator
    if (task.creator_id) {
      sendTaskNotification(
        task.creator_id,
        `Bắt đầu thực hiện: ${task.task_code}`,
        `Nhân viên ${req.user?.full_name || req.user?.username} đã bắt đầu thực hiện công việc "${task.title}".`,
        taskId,
        'INFO'
      );
    }

    res.json({ success: true, message: 'Đã chuyển trạng thái sang Đang thực hiện' });
  } catch (error: any) {
    console.error('Error starting task:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi bắt đầu thực hiện công việc' });
  }
});

// 7. PUT /api/tasks/:id/progress - Update progress & notes (CẬP NHẬT TIẾN ĐỘ)
// BACKEND SECURITY RULE: ONLY the assigned account can update progress!
router.put('/:id/progress', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { progress, notes } = req.body;

    const task = dbQueryOne("SELECT * FROM tasks WHERE id = ?", [taskId]);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
    }

    // MANDATORY 403 CHECK
    if (!isTaskAssignee(task, req.user)) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Bạn không có quyền cập nhật tiến độ công việc này! Chỉ người được giao mới có quyền cập nhật.'
      });
    }

    const progNum = Math.min(Math.max(parseInt(progress, 10) || 0, 0), 99); // 100% requires submission
    const oldProgress = task.progress || 0;

    dbRun(
      `UPDATE tasks SET
        progress = ?,
        status = CASE WHEN status = 'ACCEPTED' THEN 'IN_PROGRESS' ELSE status END,
        notes = CASE WHEN ? != '' THEN ? ELSE notes END,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [progNum, notes || '', notes || '', taskId]
    );

    // Record history
    recordTaskHistory(
      taskId,
      req.user,
      'CAP_NHAT_TIEN_DO',
      `Cập nhật tiến độ (${progNum}%)`,
      task.status,
      task.status === 'ACCEPTED' ? 'IN_PROGRESS' : task.status,
      progNum,
      notes || `Tiến độ chuyển từ ${oldProgress}% lên ${progNum}%`
    );

    // Notify creator
    if (task.creator_id) {
      sendTaskNotification(
        task.creator_id,
        `Cập nhật tiến độ: ${task.task_code} (${progNum}%)`,
        `Nhân viên ${req.user?.full_name || req.user?.username} đã cập nhật tiến độ công việc "${task.title}" đạt ${progNum}%.`,
        taskId,
        'INFO'
      );
    }

    broadcastRealtimeEvent({
      type: 'UPDATE',
      entity: 'TASK',
      action: 'PROGRESS',
      id: taskId,
      data: { title: task.title, progress: progNum }
    });

    res.json({ success: true, message: `Đã cập nhật tiến độ ${progNum}%` });
  } catch (error: any) {
    console.error('Error updating progress:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật tiến độ' });
  }
});

// 8. POST /api/tasks/:id/submit-results - Employee submits completion (GỬI HOÀN TẤT -> CHỜ XÁC NHẬN)
// BACKEND SECURITY RULE: ONLY the assigned account can submit completion!
// Transitions status: IN_PROGRESS -> PENDING_APPROVAL (Chờ xác nhận)
router.post('/:id/submit-results', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { results, notes, progress } = req.body;

    const task = dbQueryOne("SELECT * FROM tasks WHERE id = ?", [taskId]);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
    }

    // MANDATORY 403 CHECK
    if (!isTaskAssignee(task, req.user)) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Bạn không có quyền gửi hoàn tất công việc này! Theo nguyên tắc “giao cho ai – chỉ người đó được thực hiện”, chỉ người được giao mới có quyền gửi kết quả hoàn tất.'
      });
    }

    // Save/Replace checklist results
    dbRun("DELETE FROM task_checklist_results WHERE task_id = ?", [taskId]);

    if (Array.isArray(results) && results.length > 0) {
      for (const r of results) {
        dbRun(
          `INSERT INTO task_checklist_results (
            task_id, checklist_id, checklist_item_id, item_content, standard_value, unit,
            result_value, is_pass, notes, image_url, completed_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            taskId,
            task.checklist_id || 0,
            r.checklist_item_id,
            r.item_content || '',
            r.standard_value || '',
            r.unit || '',
            r.result_value !== undefined ? String(r.result_value) : '',
            r.is_pass ? 1 : (r.is_pass === false ? 0 : null),
            r.notes || '',
            r.image_url || '',
            req.user?.full_name || req.user?.username || 'SYSTEM'
          ]
        );
      }
    }

    const oldStatus = task.status;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Transition to PENDING_APPROVAL (Chờ xác nhận)
    dbRun(
      `UPDATE tasks SET
        status = 'PENDING_APPROVAL',
        progress = 100,
        submitted_at = ?,
        notes = CASE WHEN ? != '' THEN ? ELSE notes END,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nowStr, notes || '', notes || '', taskId]
    );

    // Record history
    recordTaskHistory(
      taskId,
      req.user,
      'GUI_HOAN_TAT',
      'Gửi kết quả hoàn tất',
      oldStatus,
      'PENDING_APPROVAL',
      100,
      notes || 'Nhân viên đã hoàn tất các hạng mục kiểm tra/thao tác và gửi người giao việc xác nhận'
    );

    // Notify creator to review & approve
    if (task.creator_id) {
      sendTaskNotification(
        task.creator_id,
        `Chờ xác nhận hoàn thành: ${task.task_code}`,
        `Nhân viên ${req.user?.full_name || req.user?.username} đã gửi kết quả hoàn tất công việc "${task.title}". Vui lòng kiểm tra và xác nhận kết quả.`,
        taskId,
        'ALERT'
      );
    }

    // Audit log
    dbRun(
      `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
       VALUES (?, ?, ?, 'GUI_HOAN_TAT_TASK', 'CONG_VIEC', ?, ?, 'SUCCESS')`,
      [
        req.user?.id || 1,
        req.user?.username || 'SYSTEM',
        req.user?.full_name || 'Hệ thống',
        task.task_code,
        `Gửi kết quả hoàn tất công việc "${task.title}" (Chờ xác nhận)`
      ]
    );

    res.json({
      success: true,
      message: 'Đã gửi kết quả hoàn tất thành công! Trạng thái công việc chuyển sang “Chờ xác nhận” để người giao việc nghiệm thu.'
    });
  } catch (error: any) {
    console.error('Error submitting task results:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi gửi kết quả kiểm tra' });
  }
});

// 9. POST /api/tasks/:id/approve - Cán bộ phương thức or Admin confirms completion (XÁC NHẬN KẾT QUẢ HOÀN THÀNH)
// BACKEND SECURITY RULE: ONLY "CAN_BO_PHUONG_THUC" or "ADMIN" can approve!
// Transitions status: PENDING_APPROVAL -> COMPLETED
router.post('/:id/approve', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { approval_notes } = req.body || {};

    const task = dbQueryOne("SELECT * FROM tasks WHERE id = ?", [taskId]);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
    }

    // MANDATORY 403 CHECK: STRICTLY "CAN_BO_PHUONG_THUC" OR "ADMIN"
    if (!isCanBoPhuongThucOrAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Chỉ tài khoản có phân quyền “Cán bộ phương thức” hoặc “Quản trị hệ thống (Admin)” mới được phép xác nhận hoàn thành công việc.'
      });
    }

    const oldStatus = task.status;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const approverFullname = req.user?.full_name || req.user?.username || 'Cán bộ phương thức';

    dbRun(
      `UPDATE tasks SET
        status = 'COMPLETED',
        completed_at = ?,
        completed_by = ?,
        approved_by_user_id = ?,
        approved_by_username = ?,
        approved_by_fullname = ?,
        approved_at = ?,
        approval_notes = ?,
        progress = 100,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        nowStr,
        approverFullname,
        req.user?.id || null,
        req.user?.username || 'SYSTEM',
        approverFullname,
        nowStr,
        approval_notes || '',
        taskId
      ]
    );

    // Record history
    recordTaskHistory(
      taskId,
      req.user,
      'XAC_NHAN_HOAN_TAT',
      'Xác nhận hoàn tất',
      oldStatus,
      'COMPLETED',
      100,
      approval_notes || `Cán bộ phương thức / Quản trị (${approverFullname}) đã nghiệm thu và xác nhận hoàn thành công việc`
    );

    // Notify assignee
    if (task.assigned_to_user_id) {
      sendTaskNotification(
        task.assigned_to_user_id,
        `Công việc đã hoàn tất: ${task.task_code}`,
        `${approverFullname} đã nghiệm thu và xác nhận hoàn tất công việc "${task.title}".${approval_notes ? ` Đánh giá: ${approval_notes}` : ''}`,
        taskId,
        'INFO'
      );
    }

    // Audit log
    dbRun(
      `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
       VALUES (?, ?, ?, 'NGHIEM_THU_HOAN_TAT', 'CONG_VIEC', ?, ?, 'SUCCESS')`,
      [
        req.user?.id || 1,
        req.user?.username || 'SYSTEM',
        approverFullname,
        task.task_code,
        `Xác nhận hoàn tất công việc "${task.title}"`
      ]
    );

    res.json({ success: true, message: 'Đã xác nhận hoàn thành công việc thành công' });
  } catch (error: any) {
    console.error('Error approving task:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xác nhận hoàn thành công việc' });
  }
});

// 10. POST /api/tasks/:id/reject-completion - Cán bộ phương thức or Admin requests rework (TỪ CHỐI DUYỆT / YÊU CẦU LÀM LẠI)
// BACKEND SECURITY RULE: ONLY "CAN_BO_PHUONG_THUC" or "ADMIN" can reject completion!
router.post('/:id/reject-completion', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do yêu cầu làm lại' });
    }

    const task = dbQueryOne("SELECT * FROM tasks WHERE id = ?", [taskId]);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
    }

    // MANDATORY 403 CHECK: STRICTLY "CAN_BO_PHUONG_THUC" OR "ADMIN"
    if (!isCanBoPhuongThucOrAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Chỉ tài khoản có phân quyền “Cán bộ phương thức” hoặc “Quản trị hệ thống (Admin)” mới được phép yêu cầu làm lại công việc.'
      });
    }

    const oldStatus = task.status;
    const reviewerName = req.user?.full_name || req.user?.username || 'Cán bộ phương thức';

    dbRun(
      `UPDATE tasks SET
        status = 'RETURNED',
        return_reason = ?,
        progress = 70,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reason, taskId]
    );

    // Record history
    recordTaskHistory(
      taskId,
      req.user,
      'YEU_CAU_LAM_LAI',
      'Yêu cầu làm lại / bổ sung',
      oldStatus,
      'RETURNED',
      70,
      `Yêu cầu bổ sung: ${reason}`
    );

    // Notify assignee
    if (task.assigned_to_user_id) {
      sendTaskNotification(
        task.assigned_to_user_id,
        `Yêu cầu bổ sung công việc: ${task.task_code}`,
        `${reviewerName} yêu cầu kiểm tra lại công việc "${task.title}". Lý do: ${reason}`,
        taskId,
        'WARNING'
      );
    }

    res.json({ success: true, message: 'Đã gửi yêu cầu làm lại tới người thực hiện' });
  } catch (error: any) {
    console.error('Error rejecting task completion:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi gửi yêu cầu làm lại' });
  }
});

// 11. POST /api/tasks/:id/return - Employee returns task / refuses task (TỪ CHỐI NHẬN / TRẢ LẠI VIỆC)
// BACKEND SECURITY RULE: ONLY the assigned account can return/refuse!
router.post('/:id/return', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { return_reason } = req.body;

    if (!return_reason) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do trả lại công việc' });
    }

    const task = dbQueryOne("SELECT * FROM tasks WHERE id = ?", [taskId]);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
    }

    // MANDATORY 403 CHECK
    if (!isTaskAssignee(task, req.user)) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Bạn không phải là người được giao nên không thể từ chối/trả lại công việc này!'
      });
    }

    const oldStatus = task.status;
    const employeeName = req.user?.full_name || req.user?.username || 'Nhân viên';

    dbRun(
      `UPDATE tasks SET
        status = 'RETURNED',
        return_reason = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [return_reason, taskId]
    );

    // Record history
    recordTaskHistory(
      taskId,
      req.user,
      'TU_CHOI_TRA_LAI',
      'Từ chối nhận / Trả lại việc',
      oldStatus,
      'RETURNED',
      task.progress || 0,
      `Lý do: ${return_reason}`
    );

    // Notify creator
    if (task.creator_id) {
      sendTaskNotification(
        task.creator_id,
        `Nhân viên trả lại công việc: ${task.task_code}`,
        `Nhân viên ${employeeName} đã từ chối/trả lại công việc "${task.title}". Lý do: ${return_reason}`,
        taskId,
        'WARNING'
      );
    }

    res.json({ success: true, message: 'Đã trả lại công việc thành công' });
  } catch (error: any) {
    console.error('Error returning task:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi trả lại công việc' });
  }
});

// 12. POST /api/tasks/:id/pause - Pause execution (TẠM DỪNG)
router.post('/:id/pause', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { reason } = req.body || {};

    const task = dbQueryOne("SELECT * FROM tasks WHERE id = ?", [taskId]);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
    }

    const isAssignee = isTaskAssignee(task, req.user);
    const isCreator = isTaskCreator(task, req.user);
    const isSupervisor = isManagerOrAdmin(req.user);

    if (!isAssignee && !isCreator && !isSupervisor) {
      return res.status(403).json({ success: false, message: '403 Forbidden: Bạn không có quyền tạm dừng công việc này!' });
    }

    const oldStatus = task.status;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    dbRun(
      `UPDATE tasks SET
        status = 'PAUSED',
        paused_at = ?,
        pause_reason = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nowStr, reason || '', taskId]
    );

    recordTaskHistory(
      taskId,
      req.user,
      'TAM_DUNG',
      'Tạm dừng công việc',
      oldStatus,
      'PAUSED',
      task.progress || 0,
      reason || 'Tạm hoãn tiến độ công tác'
    );

    res.json({ success: true, message: 'Đã tạm dừng công việc' });
  } catch (error: any) {
    console.error('Error pausing task:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tạm dừng công việc' });
  }
});

// 13. POST /api/tasks/:id/resume - Resume execution (TIẾP TỤC)
router.post('/:id/resume', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { notes } = req.body || {};

    const task = dbQueryOne("SELECT * FROM tasks WHERE id = ?", [taskId]);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
    }

    const isAssignee = isTaskAssignee(task, req.user);
    const isCreator = isTaskCreator(task, req.user);
    const isSupervisor = isManagerOrAdmin(req.user);

    if (!isAssignee && !isCreator && !isSupervisor) {
      return res.status(403).json({ success: false, message: '403 Forbidden: Bạn không có quyền tiếp tục công việc này!' });
    }

    const oldStatus = task.status;

    dbRun(
      `UPDATE tasks SET
        status = 'IN_PROGRESS',
        pause_reason = NULL,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [taskId]
    );

    recordTaskHistory(
      taskId,
      req.user,
      'TIEP_TUC',
      'Tiếp tục thực hiện',
      oldStatus,
      'IN_PROGRESS',
      task.progress || 0,
      notes || 'Tiếp tục triển khai công việc sau khi tạm dừng'
    );

    res.json({ success: true, message: 'Đã tiếp tục thực hiện công việc' });
  } catch (error: any) {
    console.error('Error resuming task:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tiếp tục công việc' });
  }
});

// 14. POST /api/tasks/:id/cancel - Cancel task (HỦY CÔNG VIỆC)
router.post('/:id/cancel', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { reason } = req.body || {};

    const task = dbQueryOne("SELECT * FROM tasks WHERE id = ?", [taskId]);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
    }

    const isCreator = isTaskCreator(task, req.user);
    const isSupervisor = isManagerOrAdmin(req.user);

    if (!isCreator && !isSupervisor) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Chỉ người giao việc hoặc cấp quản lý mới có quyền hủy công việc!'
      });
    }

    const oldStatus = task.status;

    dbRun(
      `UPDATE tasks SET
        status = 'CANCELLED',
        notes = CASE WHEN ? != '' THEN ? ELSE notes END,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reason ? `[ĐÃ HỦY] ${reason}` : '', reason ? `[ĐÃ HỦY] ${reason}` : '', taskId]
    );

    recordTaskHistory(
      taskId,
      req.user,
      'HUY_CONG_VIEC',
      'Hủy công việc',
      oldStatus,
      'CANCELLED',
      task.progress || 0,
      reason || 'Hủy theo yêu cầu của người giao việc/quản lý'
    );

    if (task.assigned_to_user_id) {
      sendTaskNotification(
        task.assigned_to_user_id,
        `Công việc đã bị hủy: ${task.task_code}`,
        `Công việc "${task.title}" đã bị hủy bởi ${req.user?.full_name || req.user?.username}.${reason ? ` Lý do: ${reason}` : ''}`,
        taskId,
        'WARNING'
      );
    }

    res.json({ success: true, message: 'Đã hủy công việc thành công' });
  } catch (error: any) {
    console.error('Error cancelling task:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi hủy công việc' });
  }
});

// 15. PUT /api/tasks/:id/status - Generic status update with strict role verification
router.put('/:id/status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { status, return_reason, notes, progress } = req.body;

    const task = dbQueryOne("SELECT * FROM tasks WHERE id = ?", [taskId]);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
    }

    const isAssignee = isTaskAssignee(task, req.user);
    const isCreator = isTaskCreator(task, req.user);
    const isSupervisor = isManagerOrAdmin(req.user);

    // Enforcement according to status target
    if (['ACCEPTED', 'IN_PROGRESS'].includes(status)) {
      if (!isAssignee) {
        return res.status(403).json({
          success: false,
          message: '403 Forbidden: Bạn không phải người được giao việc nên không thể nhận hoặc thực hiện công việc này.'
        });
      }
    } else if (status === 'COMPLETED') {
      if (!isCreator && !isSupervisor) {
        return res.status(403).json({
          success: false,
          message: '403 Forbidden: Chỉ người giao việc hoặc cấp quản lý mới có quyền xác nhận Hoàn tất.'
        });
      }
    } else if (status === 'CANCELLED') {
      if (!isCreator && !isSupervisor) {
        return res.status(403).json({
          success: false,
          message: '403 Forbidden: Chỉ người giao việc hoặc cấp quản lý mới có quyền Hủy công việc.'
        });
      }
    } else if (status === 'RETURNED') {
      if (!isAssignee && !isCreator && !isSupervisor) {
        return res.status(403).json({
          success: false,
          message: '403 Forbidden: Bạn không có quyền thao tác trên công việc này.'
        });
      }
    }

    const oldStatus = task.status;
    const progVal = progress !== undefined ? progress : (status === 'COMPLETED' ? 100 : (status === 'IN_PROGRESS' && !task.progress ? 10 : task.progress));

    dbRun(
      `UPDATE tasks SET
        status = ?,
        progress = ?,
        return_reason = ?,
        notes = CASE WHEN ? != '' THEN ? ELSE notes END,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, progVal || 0, return_reason || null, notes || '', notes || '', taskId]
    );

    recordTaskHistory(
      taskId,
      req.user,
      'CAP_NHAT_TRANG_THAI',
      `Cập nhật trạng thái sang ${status}`,
      oldStatus,
      status,
      progVal,
      return_reason ? `Lý do: ${return_reason}` : notes
    );

    broadcastRealtimeEvent({
      type: 'UPDATE',
      entity: 'TASK',
      action: 'STATUS',
      id: taskId,
      data: { title: task.title, status }
    });

    res.json({ success: true, message: 'Cập nhật trạng thái công việc thành công' });
  } catch (error: any) {
    console.error('Error updating task status:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi cập nhật trạng thái công việc' });
  }
});

// 16. GET /api/tasks/:id/history - Task history list
router.get('/:id/history', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const history = dbQuery(
      `SELECT * FROM task_histories WHERE task_id = ? ORDER BY created_at ASC`,
      [taskId]
    );
    res.json({ success: true, data: history });
  } catch (error: any) {
    console.error('Error fetching task history:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy lịch sử thao tác' });
  }
});

// 17. DELETE /api/tasks/:id - Delete task
router.delete('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const task = dbQueryOne("SELECT * FROM tasks WHERE id = ?", [taskId]);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
    }

    const isCreator = isTaskCreator(task, req.user);
    const isSupervisor = isManagerOrAdmin(req.user);

    if (!isCreator && !isSupervisor) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Chỉ người giao việc hoặc cấp quản lý mới có quyền xóa công việc.'
      });
    }

    dbRun("DELETE FROM tasks WHERE id = ?", [taskId]);

    broadcastRealtimeEvent({
      type: 'DELETE',
      entity: 'TASK',
      action: 'DELETE',
      id: taskId
    });

    dbRun(
      `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
       VALUES (?, ?, ?, 'XOA_CONG_VIEC', 'CONG_VIEC', ?, ?, 'SUCCESS')`,
      [
        req.user?.id || 1,
        req.user?.username || 'SYSTEM',
        req.user?.full_name || 'Hệ thống',
        task.task_code,
        `Xóa công việc "${task.title}"`
      ]
    );

    res.json({ success: true, message: 'Đã xóa công việc thành công' });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa công việc' });
  }
});

export default router;
