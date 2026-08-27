import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { dbQuery, dbQueryOne, dbRun } from '../db';
import { authenticateToken, denyGuestMutations, requirePermission, recordAuditLog, AuthenticatedRequest } from '../middleware';

const router = Router();

// Apply auth and guest mutation blocking to all user routes
router.use(authenticateToken);
router.use(denyGuestMutations);

router.use((req, res, next) => {
  console.log(`Users Route: ${req.method} ${req.originalUrl}`);
  next();
});


// GET /api/users/pending - Quick list of users awaiting approval
router.get('/pending', requirePermission('users:read'), (req: AuthenticatedRequest, res) => {
  const users = dbQuery(
    `SELECT u.id, u.employee_code, u.full_name, u.username, u.email, u.phone, 
            u.unit, u.team, u.title, u.status, u.created_at, u.updated_at, u.created_by, u.updated_by
     FROM users u
     WHERE u.deleted_at IS NULL AND u.status = 'PENDING'
     ORDER BY u.created_at DESC`
  );

  const enriched = users.map(user => {
    const roleRows = dbQuery(
      `SELECT r.code, r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?`,
      [user.id]
    );
    const scopeRows = dbQuery(
      `SELECT scope_type, scope_value FROM user_scopes WHERE user_id = ?`,
      [user.id]
    );
    return {
      ...user,
      roles: roleRows.map(r => r.code),
      role_names: roleRows.map(r => r.name),
      scopes: scopeRows
    };
  });

  return res.json({
    success: true,
    data: enriched,
    total: enriched.length
  });
});

// GET /api/users - List users with filtering
router.get('/', requirePermission('users:read'), (req: AuthenticatedRequest, res) => {
  const { search, role, status, unit, team } = req.query;

  let query = `
    SELECT u.id, u.employee_code, u.full_name, u.username, u.email, u.phone, 
           u.unit, u.team, u.title, u.status, u.created_at, u.updated_at, u.created_by, u.updated_by,
           u.approved_by, u.approved_at, u.rejected_by, u.rejected_at, u.rejection_reason
    FROM users u
    WHERE u.deleted_at IS NULL
  `;
  const params: any[] = [];

  if (search) {
    query += ` AND (u.full_name LIKE ? OR u.username LIKE ? OR u.employee_code LIKE ? OR u.email LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (status) {
    query += ` AND u.status = ?`;
    params.push(status);
  }

  if (unit) {
    query += ` AND u.unit = ?`;
    params.push(unit);
  }

  if (team) {
    query += ` AND u.team = ?`;
    params.push(team);
  }

  query += ` ORDER BY u.created_at DESC`;

  const users = dbQuery(query, params);

  // Attach Roles and Scopes to each user
  const enrichedUsers = users.map(user => {
    const roleRows = dbQuery(
      `SELECT r.code, r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?`,
      [user.id]
    );

    const scopeRows = dbQuery(
      `SELECT scope_type, scope_value FROM user_scopes WHERE user_id = ?`,
      [user.id]
    );

    return {
      ...user,
      roles: roleRows.map(r => r.code),
      role_names: roleRows.map(r => r.name),
      scopes: scopeRows
    };
  });

  // Filter by role if requested in query parameter
  let finalResult = enrichedUsers;
  if (role) {
    finalResult = enrichedUsers.filter(u => u.roles.includes(role as string));
  }

  return res.json({
    success: true,
    data: finalResult,
    total: finalResult.length
  });
});

// GET /api/users/:id - Get single user
router.get('/:id', requirePermission('users:read'), (req: AuthenticatedRequest, res) => {
  const userId = parseInt(req.params.id, 10);
  const user = dbQueryOne(
    `SELECT u.id, u.employee_code, u.full_name, u.username, u.email, u.phone, 
            u.unit, u.team, u.title, u.status, u.created_at, u.updated_at, u.created_by, u.updated_by,
            u.approved_by, u.approved_at, u.rejected_by, u.rejected_at, u.rejection_reason
     FROM users u
     WHERE u.id = ? AND u.deleted_at IS NULL`,
    [userId]
  );

  if (!user) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
  }

  const roleRows = dbQuery(
    `SELECT r.code, r.name, r.id as role_id FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?`,
    [userId]
  );

  const scopeRows = dbQuery(
    `SELECT id, scope_type, scope_value FROM user_scopes WHERE user_id = ?`,
    [userId]
  );

  return res.json({
    success: true,
    data: {
      ...user,
      roles: roleRows.map(r => r.code),
      role_names: roleRows.map(r => r.name),
      role_ids: roleRows.map(r => r.role_id),
      scopes: scopeRows
    }
  });
});

// POST /api/users - Create User
router.post('/', requirePermission('users:create'), async (req: AuthenticatedRequest, res) => {
  const {
    employee_code,
    full_name,
    username,
    email,
    phone,
    unit,
    team,
    title,
    password,
    roles, // array of role codes e.g. ['TRUONG_CA']
    scopes // array of { scope_type, scope_value }
  } = req.body;

  // Basic Validation
  if (!employee_code || !full_name || !username || !email || !unit || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ các thông tin bắt buộc (*)' });
  }

  // Check unique constraints
  const existingCode = dbQueryOne(`SELECT id FROM users WHERE employee_code = ? AND deleted_at IS NULL`, [employee_code.trim()]);
  if (existingCode) {
    return res.status(400).json({ success: false, message: `Mã nhân viên '${employee_code}' đã tồn tại trong hệ thống.` });
  }

  const existingUsername = dbQueryOne(`SELECT id FROM users WHERE username = ? AND deleted_at IS NULL`, [username.trim()]);
  if (existingUsername) {
    return res.status(400).json({ success: false, message: `Tên đăng nhập '${username}' đã tồn tại.` });
  }

  const existingEmail = dbQueryOne(`SELECT id FROM users WHERE email = ? AND deleted_at IS NULL`, [email.trim()]);
  if (existingEmail) {
    return res.status(400).json({ success: false, message: `Email '${email}' đã được sử dụng.` });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const createdBy = req.user?.username || 'SYSTEM';

  // Transactional Insert
  dbRun(
    `INSERT INTO users (employee_code, full_name, username, email, phone, unit, team, title, status, password_hash, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
    [
      employee_code.trim(),
      full_name.trim(),
      username.trim(),
      email.trim(),
      phone ? phone.trim() : '',
      unit.trim(),
      team ? team.trim() : 'Đội Vận hành',
      title ? title.trim() : 'Chuyên viên',
      hashedPassword,
      createdBy,
      createdBy
    ]
  );

  const newUser = dbQueryOne(`SELECT id FROM users WHERE username = ?`, [username.trim()]);
  const newUserId = newUser.id as number;

  // Assign Roles
  if (Array.isArray(roles) && roles.length > 0) {
    for (const rCode of roles) {
      const rRow = dbQueryOne(`SELECT id, status FROM roles WHERE code = ? OR id = ?`, [rCode, rCode]);
      if (!rRow || rRow.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: 'Nhóm phân quyền này đã được vô hiệu hóa và không thể gán cho tài khoản.'
        });
      }
    }
    for (const rCode of roles) {
      const rRow = dbQueryOne(`SELECT id FROM roles WHERE code = ? OR id = ?`, [rCode, rCode]);
      if (rRow) {
        dbRun(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [newUserId, rRow.id]);
      }
    }
  } else {
    // Default role: KHACH
    const defaultRole = dbQueryOne(`SELECT id FROM roles WHERE code = 'KHACH'`);
    if (defaultRole) {
      dbRun(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [newUserId, defaultRole.id]);
    }
  }

  // Assign Scopes
  if (Array.isArray(scopes) && scopes.length > 0) {
    for (const sc of scopes) {
      if (sc.scope_type && sc.scope_value) {
        dbRun(
          `INSERT INTO user_scopes (user_id, scope_type, scope_value) VALUES (?, ?, ?)`,
          [newUserId, sc.scope_type, sc.scope_value]
        );
      }
    }
  } else {
    // Default scope: SYSTEM / TOAN_HE_THONG
    dbRun(`INSERT INTO user_scopes (user_id, scope_type, scope_value) VALUES (?, 'SYSTEM', 'TOAN_HE_THONG')`, [newUserId]);
  }

  // Audit Log
  recordAuditLog({
    user_id: req.user!.id,
    username: req.user!.username,
    user_fullname: req.user!.full_name,
    action: 'CREATE_USER',
    module: 'QUAN_LY_NGUOI_DUNG',
    target_id: newUserId,
    details: `Tạo tài khoản người dùng mới: ${full_name} (${username}) - Mã NV: ${employee_code}`,
    result: 'SUCCESS',
    ip_address: req.ip
  });

  return res.status(201).json({
    success: true,
    message: `Đã tạo thành công tài khoản [${username}] cho ${full_name}`
  });
});

// PUT /api/users/:id/change-password - Change password
router.put('/:id/change-password', async (req: AuthenticatedRequest, res) => {
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

// PUT /api/users/:id - Update user details
router.put('/:id', requirePermission('users:update'), async (req: AuthenticatedRequest, res) => {
  const userId = parseInt(req.params.id, 10);
  const {
    full_name,
    email,
    phone,
    unit,
    team,
    title,
    password,
    roles,
    scopes
  } = req.body;

  const existingUser = dbQueryOne(`SELECT id, username, full_name FROM users WHERE id = ? AND deleted_at IS NULL`, [userId]);
  if (!existingUser) {
    return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
  }

  const updatedBy = req.user?.username || 'SYSTEM';

  if (password && password.trim().length > 0) {
    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    dbRun(
      `UPDATE users 
       SET full_name = ?, email = ?, phone = ?, unit = ?, team = ?, title = ?, 
           password_hash = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
       WHERE id = ?`,
      [full_name, email, phone, unit, team, title, hashedPassword, updatedBy, userId]
    );
  } else {
    dbRun(
      `UPDATE users 
       SET full_name = ?, email = ?, phone = ?, unit = ?, team = ?, title = ?, 
           updated_at = CURRENT_TIMESTAMP, updated_by = ?
       WHERE id = ?`,
      [full_name, email, phone, unit, team, title, updatedBy, userId]
    );
  }

  // Update Roles if provided
  if (Array.isArray(roles)) {
    for (const rCode of roles) {
      const rRow = dbQueryOne(`SELECT id, status FROM roles WHERE code = ? OR id = ?`, [rCode, rCode]);
      if (!rRow || rRow.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: 'Nhóm phân quyền này đã được vô hiệu hóa và không thể gán cho tài khoản.'
        });
      }
    }
    dbRun(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
    for (const rCode of roles) {
      const rRow = dbQueryOne(`SELECT id FROM roles WHERE code = ? OR id = ?`, [rCode, rCode]);
      if (rRow) {
        dbRun(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [userId, rRow.id]);
      }
    }
  }

  // Update Scopes if provided
  if (Array.isArray(scopes)) {
    dbRun(`DELETE FROM user_scopes WHERE user_id = ?`, [userId]);
    for (const sc of scopes) {
      if (sc.scope_type && sc.scope_value) {
        dbRun(
          `INSERT INTO user_scopes (user_id, scope_type, scope_value) VALUES (?, ?, ?)`,
          [userId, sc.scope_type, sc.scope_value]
        );
      }
    }
  }

  recordAuditLog({
    user_id: req.user!.id,
    username: req.user!.username,
    user_fullname: req.user!.full_name,
    action: 'UPDATE_USER',
    module: 'QUAN_LY_NGUOI_DUNG',
    target_id: userId,
    details: `Cập nhật thông tin tài khoản ID: ${userId} (${existingUser.username})`,
    result: 'SUCCESS',
    ip_address: req.ip
  });

  return res.json({
    success: true,
    message: `Đã cập nhật thông tin người dùng [${existingUser.username}]`
  });
});

// PATCH /api/users/:id/approve - Approve pending user account
router.patch('/:id/approve', requirePermission('users:update'), (req: AuthenticatedRequest, res) => {
  const userId = parseInt(req.params.id, 10);
  const { role, roles, unit, team, title, scopes } = req.body;

  const existingUser = dbQueryOne(`SELECT id, username, full_name, unit, team FROM users WHERE id = ? AND deleted_at IS NULL`, [userId]);
  if (!existingUser) {
    return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
  }

  const approvedBy = req.user?.username || 'ADMIN';

  // 1. Update basic info if provided
  let updateFields: string[] = ['status = "ACTIVE"', 'approved_by = ?', 'approved_at = CURRENT_TIMESTAMP', 'updated_at = CURRENT_TIMESTAMP', 'updated_by = ?'];
  let updateParams: any[] = [approvedBy, approvedBy];

  if (unit) {
    updateFields.push('unit = ?');
    updateParams.push(unit.trim());
  }
  if (team) {
    updateFields.push('team = ?');
    updateParams.push(team.trim());
  }
  if (title) {
    updateFields.push('title = ?');
    updateParams.push(title.trim());
  }

  updateParams.push(userId);
  dbRun(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);

  // 2. Assign Role if provided
  const targetRoles = roles || (role ? [role] : null);
  if (Array.isArray(targetRoles) && targetRoles.length > 0) {
    dbRun(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
    for (const rCode of targetRoles) {
      const rRow = dbQueryOne(`SELECT id, status FROM roles WHERE code = ? OR id = ?`, [rCode, rCode]);
      if (rRow && (!rRow.status || rRow.status === 'ACTIVE')) {
        dbRun(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [userId, rRow.id]);
      }
    }
  }

  // 3. Assign Scopes if provided
  if (Array.isArray(scopes) && scopes.length > 0) {
    dbRun(`DELETE FROM user_scopes WHERE user_id = ?`, [userId]);
    for (const sc of scopes) {
      if (sc.scope_type && sc.scope_value) {
        dbRun(
          `INSERT INTO user_scopes (user_id, scope_type, scope_value) VALUES (?, ?, ?)`,
          [userId, sc.scope_type, sc.scope_value]
        );
      }
    }
  }

  recordAuditLog({
    user_id: req.user!.id,
    username: req.user!.username,
    user_fullname: req.user!.full_name,
    action: 'APPROVE_USER',
    module: 'QUAN_LY_NGUOI_DUNG',
    target_id: userId,
    details: `Phê duyệt tài khoản: ${existingUser.username} (${existingUser.full_name}) chuyển sang trạng thái HOẠT ĐỘNG (ACTIVE)`,
    result: 'SUCCESS',
    ip_address: req.ip
  });

  return res.json({
    success: true,
    message: `Đã phê duyệt và kích hoạt tài khoản [${existingUser.username}] thành công!`
  });
});

// PATCH /api/users/:id/reject - Reject pending user account
router.patch('/:id/reject', requirePermission('users:update'), (req: AuthenticatedRequest, res) => {
  const userId = parseInt(req.params.id, 10);
  const { reason } = req.body;

  const existingUser = dbQueryOne(`SELECT id, username, full_name FROM users WHERE id = ? AND deleted_at IS NULL`, [userId]);
  if (!existingUser) {
    return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
  }

  const rejectedBy = req.user?.username || 'ADMIN';
  const reasonText = (reason || '').trim() || 'Thông tin không đủ điều kiện hoặc không thuộc đơn vị quản lý.';

  dbRun(
    `UPDATE users 
     SET status = 'REJECTED', rejected_by = ?, rejected_at = CURRENT_TIMESTAMP, 
         rejection_reason = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
     WHERE id = ?`,
    [rejectedBy, reasonText, rejectedBy, userId]
  );

  recordAuditLog({
    user_id: req.user!.id,
    username: req.user!.username,
    user_fullname: req.user!.full_name,
    action: 'REJECT_USER',
    module: 'QUAN_LY_NGUOI_DUNG',
    target_id: userId,
    details: `Từ chối kích hoạt tài khoản ${existingUser.username}. Lý do: ${reasonText}`,
    result: 'SUCCESS',
    ip_address: req.ip
  });

  return res.json({
    success: true,
    message: `Đã từ chối kích hoạt tài khoản [${existingUser.username}]`
  });
});

// PATCH /api/users/:id/lock - Lock / Unlock User
router.patch('/:id/lock', requirePermission('users:lock'), (req: AuthenticatedRequest, res) => {
  const userId = parseInt(req.params.id, 10);
  const { locked } = req.body;

  const existingUser = dbQueryOne(`SELECT id, username, full_name, status FROM users WHERE id = ? AND deleted_at IS NULL`, [userId]);
  if (!existingUser) {
    return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
  }

  if (userId === req.user!.id && locked) {
    return res.status(400).json({ success: false, message: 'Bạn không thể tự khóa tài khoản của chính mình' });
  }

  const newStatus = locked ? 'LOCKED' : 'ACTIVE';
  dbRun(
    `UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?`,
    [newStatus, req.user!.username, userId]
  );

  const actionName = locked ? 'LOCK_USER' : 'UNLOCK_USER';
  const actionDesc = locked ? 'Khóa tài khoản' : 'Mở khóa tài khoản';

  recordAuditLog({
    user_id: req.user!.id,
    username: req.user!.username,
    user_fullname: req.user!.full_name,
    action: actionName,
    module: 'QUAN_LY_NGUOI_DUNG',
    target_id: userId,
    details: `${actionDesc} ${existingUser.username} (${existingUser.full_name})`,
    result: 'SUCCESS',
    ip_address: req.ip
  });

  return res.json({
    success: true,
    message: `Đã ${actionDesc.toLowerCase()} [${existingUser.username}] thành công`
  });
});

// PATCH /api/users/:id/role - Change User Roles & Scopes
router.patch('/:id/role', requirePermission('users:assign_role'), (req: AuthenticatedRequest, res) => {
  const userId = parseInt(req.params.id, 10);
  const { roles, scopes } = req.body;

  const existingUser = dbQueryOne(`SELECT id, username, full_name FROM users WHERE id = ? AND deleted_at IS NULL`, [userId]);
  if (!existingUser) {
    return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
  }

  if (Array.isArray(roles)) {
    for (const rCode of roles) {
      const rRow = dbQueryOne(`SELECT id, status FROM roles WHERE code = ? OR id = ?`, [rCode, rCode]);
      if (!rRow || rRow.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: 'Nhóm phân quyền này đã được vô hiệu hóa và không thể gán cho tài khoản.'
        });
      }
    }
    dbRun(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
    for (const rCode of roles) {
      const rRow = dbQueryOne(`SELECT id FROM roles WHERE code = ? OR id = ?`, [rCode, rCode]);
      if (rRow) {
        dbRun(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [userId, rRow.id]);
      }
    }
  }

  if (Array.isArray(scopes)) {
    dbRun(`DELETE FROM user_scopes WHERE user_id = ?`, [userId]);
    for (const sc of scopes) {
      if (sc.scope_type && sc.scope_value) {
        dbRun(
          `INSERT INTO user_scopes (user_id, scope_type, scope_value) VALUES (?, ?, ?)`,
          [userId, sc.scope_type, sc.scope_value]
        );
      }
    }
  }

  recordAuditLog({
    user_id: req.user!.id,
    username: req.user!.username,
    user_fullname: req.user!.full_name,
    action: 'CHANGE_USER_ROLE',
    module: 'QUAN_LY_NGUOI_DUNG',
    target_id: userId,
    details: `Thay đổi quyền/role cho người dùng ${existingUser.username}: ${Array.isArray(roles) ? roles.join(', ') : 'N/A'}`,
    result: 'SUCCESS',
    ip_address: req.ip
  });

  return res.json({
    success: true,
    message: `Đã cập nhật vai trò phân quyền cho [${existingUser.username}]`
  });
});

// PATCH /api/users/:id/status - Lock / Unlock / Disable / Pending / Rejected
router.patch('/:id/status', requirePermission('users:lock'), (req: AuthenticatedRequest, res) => {
  const userId = parseInt(req.params.id, 10);
  const { status, reason } = req.body;

  if (!['ACTIVE', 'LOCKED', 'DISABLED', 'PENDING', 'REJECTED'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ (chấp nhận: ACTIVE, LOCKED, DISABLED, PENDING, REJECTED)' });
  }

  const existingUser = dbQueryOne(`SELECT id, username, full_name FROM users WHERE id = ? AND deleted_at IS NULL`, [userId]);
  if (!existingUser) {
    return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
  }

  // Prevent admin from locking/disabling themselves
  if (userId === req.user!.id && status !== 'ACTIVE') {
    return res.status(400).json({ success: false, message: 'Bạn không thể tự khóa hoặc vô hiệu hóa tài khoản của chính mình' });
  }

  if (status === 'REJECTED') {
    dbRun(
      `UPDATE users SET status = ?, rejection_reason = ?, rejected_by = ?, rejected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?`,
      [status, reason || '', req.user!.username, req.user!.username, userId]
    );
  } else if (status === 'ACTIVE') {
    dbRun(
      `UPDATE users SET status = ?, approved_by = COALESCE(approved_by, ?), approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?`,
      [status, req.user!.username, req.user!.username, userId]
    );
  } else {
    dbRun(
      `UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?`,
      [status, req.user!.username, userId]
    );
  }

  const statusMap: Record<string, string> = {
    'ACTIVE': 'KÍCH HOẠT / MỞ KHÓA',
    'LOCKED': 'TẠM KHÓA',
    'DISABLED': 'VÔ HIỆU HÓA',
    'PENDING': 'CHỜ DUYỆT',
    'REJECTED': 'TỪ CHỐI'
  };

  recordAuditLog({
    user_id: req.user!.id,
    username: req.user!.username,
    user_fullname: req.user!.full_name,
    action: 'CHANGE_USER_STATUS',
    module: 'QUAN_LY_NGUOI_DUNG',
    target_id: userId,
    details: `Thay đổi trạng thái tài khoản ${existingUser.username} thành [${statusMap[status]}]`,
    result: 'SUCCESS',
    ip_address: req.ip
  });

  return res.json({
    success: true,
    message: `Đã cập nhật trạng thái tài khoản [${existingUser.username}] thành ${statusMap[status]}`
  });
});

// DELETE /api/users/:id - Soft Delete User
router.delete('/:id', requirePermission('users:delete'), (req: AuthenticatedRequest, res) => {
  const userId = parseInt(req.params.id, 10);

  const existingUser = dbQueryOne(`SELECT id, username, full_name FROM users WHERE id = ? AND deleted_at IS NULL`, [userId]);
  if (!existingUser) {
    return res.status(404).json({ success: false, message: 'Người dùng không tồn tại hoặc đã bị xóa' });
  }

  if (userId === req.user!.id) {
    return res.status(400).json({ success: false, message: 'Bạn không thể tự xóa tài khoản của chính mình' });
  }

  dbRun(
    `UPDATE users SET deleted_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?`,
    [req.user!.username, userId]
  );

  recordAuditLog({
    user_id: req.user!.id,
    username: req.user!.username,
    user_fullname: req.user!.full_name,
    action: 'DELETE_USER_SOFT',
    module: 'QUAN_LY_NGUOI_DUNG',
    target_id: userId,
    details: `Xóa mềm (Soft Delete) tài khoản ${existingUser.username} (${existingUser.full_name})`,
    result: 'SUCCESS',
    ip_address: req.ip
  });

  return res.json({
    success: true,
    message: `Đã xóa mềm thành công tài khoản [${existingUser.username}]`
  });
});

export default router;
