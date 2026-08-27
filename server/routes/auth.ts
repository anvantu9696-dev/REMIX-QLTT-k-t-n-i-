import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbQuery, dbQueryOne, dbRun } from '../db';
import { authenticateToken, recordAuditLog, AuthenticatedRequest } from '../middleware';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'quan_ly_thiet_bi_luoi_dien_secret_key_2026';

// POST /api/auth/guest-login
router.post('/guest-login', async (req, res) => {
  // Find a guest user in DB or create a virtual session for guest access mode
  const guestUser = dbQueryOne(
    `SELECT u.id, u.username, u.employee_code, u.full_name, u.email, u.unit, u.team, u.title, u.status 
     FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id 
     WHERE r.code = 'KHACH' AND u.status = 'ACTIVE' LIMIT 1`
  );

  let userId = guestUser ? guestUser.id : 0;
  let username = guestUser ? guestUser.username : 'guest_viewer';
  let fullName = guestUser ? guestUser.full_name : 'Khách Chỉ Xem';

  // Generate JWT Token with guest access mode
  const token = jwt.sign(
    { userId, username, accessMode: 'GUEST' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  recordAuditLog({
    user_id: userId,
    username: username,
    user_fullname: fullName,
    action: 'GUEST_LOGIN',
    module: 'XAC_THUC',
    details: 'Đăng nhập nhanh với tư cách Khách - Chỉ xem',
    result: 'SUCCESS',
    ip_address: req.ip
  });

  return res.json({
    success: true,
    message: 'Đăng nhập thành công với tư cách KHÁCH - CHỈ XEM',
    token,
    user: {
      id: userId,
      username: username,
      employee_code: 'GUEST_01',
      full_name: fullName,
      email: 'guest@EVN.vn',
      unit: 'EVN',
      team: 'Khách Tra Cứu',
      title: 'Khách',
      status: 'ACTIVE',
      roles: ['KHACH'],
      scopes: []
    },
    permissions: [
      'VIEW_DASHBOARD',
      'VIEW_STATIONS',
      'VIEW_FEEDERS',
      'VIEW_DEVICES',
      'VIEW_TOPOLOGY',
      'VIEW_GIS',
      'VIEW_DEVICE_IMAGES',
      'VIEW_REPORTS'
    ]
  });
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const {
      full_name,
      username,
      email,
      phone,
      unit,
      team,
      title,
      password,
      confirmPassword,
      confirm_password
    } = req.body;

    const trimmedFullName = (full_name || '').trim();
    const trimmedUsername = (username || '').trim();
    const trimmedEmail = (email || '').trim();
    const trimmedPhone = (phone || '').trim();
    const trimmedUnit = (unit || '').trim();
    const trimmedTeam = (team || '').trim() || 'Đội Vận hành Lưới điện';
    const trimmedTitle = (title || '').trim() || 'Chuyên viên';
    const rawPassword = password || '';
    const rawConfirm = confirmPassword || confirm_password || '';

    // 1. Validate required fields
    if (!trimmedFullName || !trimmedUsername || !trimmedEmail || !rawPassword || !trimmedUnit) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ các thông tin bắt buộc (*): Họ tên, Tên đăng nhập, Email, Đơn vị và Mật khẩu.'
      });
    }

    // 2. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Email không đúng định dạng. Vui lòng kiểm tra lại địa chỉ email.'
      });
    }

    // 3. Validate username
    if (trimmedUsername.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập phải có ít nhất 3 ký tự.'
      });
    }

    // 4. Validate password & confirm password
    if (rawPassword !== rawConfirm) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu và xác nhận mật khẩu không khớp.'
      });
    }

    if (rawPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự để đảm bảo chính sách bảo mật hệ thống.'
      });
    }

    // 5. Check duplicate username or email
    const existingUser = dbQueryOne(
      `SELECT id, username, email FROM users WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND deleted_at IS NULL`,
      [trimmedUsername, trimmedEmail]
    );

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản đã tồn tại. Vui lòng sử dụng thông tin khác hoặc đăng nhập.'
      });
    }

    // 6. Secure Password Hashing (Hash + Salt)
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    // 7. Generate safe Employee Code
    const autoCode = `DK-${Math.floor(10000 + Math.random() * 90000)}`;

    // 8. Insert User with PENDING status (strictly ignore any elevated roles/statuses sent from frontend)
    dbRun(
      `INSERT INTO users (
        employee_code, full_name, username, email, phone, 
        unit, team, title, status, password_hash, 
        created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, 'SELF_REGISTER', 'SELF_REGISTER')`,
      [
        autoCode,
        trimmedFullName,
        trimmedUsername,
        trimmedEmail,
        trimmedPhone,
        trimmedUnit,
        trimmedTeam,
        trimmedTitle,
        passwordHash
      ]
    );

    const newUser = dbQueryOne(`SELECT id, username, full_name, email, unit, team, status FROM users WHERE username = ?`, [trimmedUsername]);
    const newUserId = newUser.id as number;

    // 9. Assign default safe role: KHACH (Guest/Viewer) with PENDING state
    const defaultRole = dbQueryOne(`SELECT id FROM roles WHERE code = 'KHACH'`);
    if (defaultRole) {
      dbRun(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [newUserId, defaultRole.id]);
    }

    // 10. Assign default user scope
    dbRun(`INSERT INTO user_scopes (user_id, scope_type, scope_value) VALUES (?, 'DON_VI', ?)`, [newUserId, trimmedUnit]);

    // 11. Record Audit Log (Strictly without passwords)
    recordAuditLog({
      user_id: newUserId,
      username: trimmedUsername,
      user_fullname: trimmedFullName,
      action: 'REGISTER',
      module: 'XAC_THUC',
      target_id: newUserId,
      details: `Người dùng tự đăng ký tài khoản: ${trimmedFullName} (${trimmedUsername}) - Đơn vị: ${trimmedUnit}. Trạng thái: CHỜ DUYỆT (PENDING)`,
      result: 'SUCCESS',
      ip_address: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công! Tài khoản của bạn đang ở trạng thái CHỜ DUYỆT. Quản trị viên sẽ xem xét và kích hoạt sớm nhất.',
      data: {
        id: newUserId,
        username: trimmedUsername,
        full_name: trimmedFullName,
        email: trimmedEmail,
        unit: trimmedUnit,
        status: 'PENDING'
      }
    });
  } catch (error: any) {
    console.error('Registration Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể tạo tài khoản. Vui lòng thử lại.'
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập Tên đăng nhập và Mật khẩu' });
  }

  const userRow = dbQueryOne(
    `SELECT id, username, employee_code, full_name, email, phone, unit, team, title, status, password_hash, rejection_reason
     FROM users WHERE (username = ? OR employee_code = ? OR email = ?) AND deleted_at IS NULL`,
    [username.trim(), username.trim(), username.trim()]
  );

  if (!userRow) {
    return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
  }

  if (userRow.status === 'PENDING') {
    recordAuditLog({
      user_id: userRow.id,
      username: userRow.username,
      user_fullname: userRow.full_name,
      action: 'LOGIN_ATTEMPT',
      module: 'XAC_THUC',
      details: 'Đăng nhập thất bại: Tài khoản đang ở trạng thái CHỜ DUYỆT (PENDING)',
      result: 'FAILURE',
      ip_address: req.ip
    });
    return res.status(403).json({
      success: false,
      status: 'PENDING',
      message: 'Tài khoản của bạn đang ở trạng thái CHỜ DUYỆT. Vui lòng liên hệ Quản trị viên để được kích hoạt.'
    });
  }

  if (userRow.status === 'REJECTED') {
    const reasonText = userRow.rejection_reason ? ` Lý do: ${userRow.rejection_reason}` : '';
    recordAuditLog({
      user_id: userRow.id,
      username: userRow.username,
      user_fullname: userRow.full_name,
      action: 'LOGIN_ATTEMPT',
      module: 'XAC_THUC',
      details: `Đăng nhập thất bại: Tài khoản đã bị TỪ CHỐI kích hoạt.${reasonText}`,
      result: 'FAILURE',
      ip_address: req.ip
    });
    return res.status(403).json({
      success: false,
      status: 'REJECTED',
      message: `Tài khoản đã bị TỪ CHỐI kích hoạt.${reasonText}`
    });
  }

  if (userRow.status === 'LOCKED') {
    recordAuditLog({
      user_id: userRow.id,
      username: userRow.username,
      user_fullname: userRow.full_name,
      action: 'LOGIN_ATTEMPT',
      module: 'XAC_THUC',
      details: 'Đăng nhập thất bại: Tài khoản đang bị TẠM KHÓA',
      result: 'FAILURE',
      ip_address: req.ip
    });
    return res.status(403).json({ success: false, status: 'LOCKED', message: 'Tài khoản của bạn đang bị TẠM KHÓA. Vui lòng liên hệ Admin.' });
  }

  if (userRow.status === 'DISABLED') {
    recordAuditLog({
      user_id: userRow.id,
      username: userRow.username,
      user_fullname: userRow.full_name,
      action: 'LOGIN_ATTEMPT',
      module: 'XAC_THUC',
      details: 'Đăng nhập thất bại: Tài khoản đã bị VÔ HIỆU HÓA',
      result: 'FAILURE',
      ip_address: req.ip
    });
    return res.status(403).json({ success: false, status: 'DISABLED', message: 'Tài khoản của bạn đã bị VÔ HIỆU HÓA.' });
  }

  const isMatch = await bcrypt.compare(password, userRow.password_hash);
  if (!isMatch) {
    recordAuditLog({
      user_id: userRow.id,
      username: userRow.username,
      user_fullname: userRow.full_name,
      action: 'LOGIN_ATTEMPT',
      module: 'XAC_THUC',
      details: 'Đăng nhập thất bại: Mật khẩu sai',
      result: 'FAILURE',
      ip_address: req.ip
    });
    return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
  }

  // Get Roles
  const roleRows = dbQuery(
    `SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?`,
    [userRow.id]
  );
  const roles = roleRows.map(r => r.code);

  // Get Permissions
  const permRows = dbQuery(
    `SELECT DISTINCT p.code FROM user_roles ur 
     JOIN role_permissions rp ON ur.role_id = rp.role_id 
     JOIN permissions p ON rp.permission_id = p.id 
     WHERE ur.user_id = ?`,
    [userRow.id]
  );
  const permissions = permRows.map(p => p.code);

  // Get Scopes
  const scopeRows = dbQuery(
    `SELECT scope_type, scope_value FROM user_scopes WHERE user_id = ?`,
    [userRow.id]
  );

  // Generate JWT Token
  const token = jwt.sign(
    { userId: userRow.id, username: userRow.username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  recordAuditLog({
    user_id: userRow.id,
    username: userRow.username,
    user_fullname: userRow.full_name,
    action: 'LOGIN',
    module: 'XAC_THUC',
    details: `Đăng nhập hệ thống thành công (Roles: ${roles.join(', ')})`,
    result: 'SUCCESS',
    ip_address: req.ip
  });

  const { password_hash, ...userInfo } = userRow;

  return res.json({
    success: true,
    message: 'Đăng nhập thành công',
    token,
    user: {
      ...userInfo,
      roles,
      scopes: scopeRows
    },
    permissions
  });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  return res.json({
    success: true,
    user: req.user,
    permissions: req.user?.permissions
  });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  const { usernameOrEmail } = req.body;
  if (!usernameOrEmail) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp Username hoặc Email' });
  }

  const userRow = dbQueryOne(
    `SELECT id, username, full_name, email FROM users WHERE (username = ? OR email = ?) AND deleted_at IS NULL`,
    [usernameOrEmail.trim(), usernameOrEmail.trim()]
  );

  if (!userRow) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản hợp lệ với thông tin đã nhập' });
  }

  recordAuditLog({
    user_id: userRow.id,
    username: userRow.username,
    user_fullname: userRow.full_name,
    action: 'FORGOT_PASSWORD_REQUEST',
    module: 'XAC_THUC',
    details: 'Yêu cầu khôi phục mật khẩu',
    result: 'SUCCESS',
    ip_address: req.ip
  });

  return res.json({
    success: true,
    message: 'Yêu cầu đặt lại mật khẩu đã được ghi nhận. Vui lòng liên hệ Quản trị viên (Admin) hệ thống để xác minh và nhận mật khẩu mới.'
  });
});

export default router;
