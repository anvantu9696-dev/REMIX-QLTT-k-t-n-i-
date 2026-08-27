import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { dbQuery, dbQueryOne, dbRun } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'quan_ly_thiet_bi_luoi_dien_secret_key_2026';

export interface AuthenticatedUser {
  id: number;
  username: string;
  employee_code: string;
  full_name: string;
  email: string;
  unit: string;
  team: string;
  title: string;
  status: string;
  roles: string[];
  permissions: string[];
  scopes: { scope_type: string; scope_value: string }[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  console.log('--- authenticateToken called for:', req.originalUrl, '---');
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để truy cập hệ thống' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
    
    // Fetch fresh user from DB
    const userRow = dbQueryOne(
      `SELECT id, username, employee_code, full_name, email, unit, team, title, status 
       FROM users WHERE id = ? AND deleted_at IS NULL`,
      [decoded.userId]
    );

    if (!userRow) {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại hoặc đã bị xóa' });
    }

    if (userRow.status === 'PENDING') {
      return res.status(403).json({ success: false, message: 'Tài khoản của bạn đang ở trạng thái CHỜ DUYỆT. Vui lòng liên hệ Quản trị viên để được kích hoạt.' });
    }

    if (userRow.status === 'REJECTED') {
      return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị TỪ CHỐI kích hoạt.' });
    }

    if (userRow.status === 'LOCKED') {
      return res.status(403).json({ success: false, message: 'Tài khoản của bạn đang bị TẠM KHÓA. Vui lòng liên hệ Admin.' });
    }

    if (userRow.status === 'DISABLED') {
      return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị VÔ HIỆU HÓA.' });
    }

    // Get User Roles
    const roleRows = dbQuery(
      `SELECT r.code 
       FROM user_roles ur 
       JOIN roles r ON ur.role_id = r.id 
       WHERE ur.user_id = ?`,
      [userRow.id]
    );
    const roles = roleRows.map(r => r.code);

    // Get User Permissions
    const permRows = dbQuery(
      `SELECT DISTINCT p.code 
       FROM user_roles ur 
       JOIN role_permissions rp ON ur.role_id = rp.role_id 
       JOIN permissions p ON rp.permission_id = p.id 
       WHERE ur.user_id = ?`,
      [userRow.id]
    );
    const permissions = permRows.map(p => p.code);

    // Get User Scopes
    const scopeRows = dbQuery(
      `SELECT scope_type, scope_value FROM user_scopes WHERE user_id = ?`,
      [userRow.id]
    );

    req.user = {
      id: userRow.id,
      username: userRow.username,
      employee_code: userRow.employee_code,
      full_name: userRow.full_name,
      email: userRow.email,
      unit: userRow.unit,
      team: userRow.team,
      title: userRow.title,
      status: userRow.status,
      roles,
      permissions,
      scopes: scopeRows.map(s => ({ scope_type: s.scope_type, scope_value: s.scope_value }))
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ' });
  }
}

// Middleware to enforce Guest read-only protection
export function denyGuestMutations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

  const isOnlyGuest = req.user.roles.length === 1 && req.user.roles[0] === 'KHACH';
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());

  if (isOnlyGuest && isMutating) {
    recordAuditLog({
      user_id: req.user.id,
      username: req.user.username,
      user_fullname: req.user.full_name,
      action: `${req.method} ${req.originalUrl}`,
      module: 'PHAN_QUYEN',
      target_id: null,
      details: 'Cố gắng thực hiện thao tác ghi/xóa với quyền KHÁCH (Bị chặn)',
      result: 'FAILURE',
      ip_address: req.ip || '127.0.0.1'
    });

    return res.status(403).json({
      success: false,
      message: 'Tài khoản KHÁCH chỉ có quyền XEM (Read-only). Không được phép thêm, sửa, xóa hoặc thực hiện thao tác thay đổi dữ liệu.'
    });
  }

  next();
}

// Middleware to require specific permission
export function requirePermission(permissionCode: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    }

    const privilegedRoles = ['ADMIN', 'CAN_BO_PHUONG_THUC', 'TRUONG_CA', 'DOI_TRUONG', 'QUAN_LY', 'LÃNH ĐẠO', 'PHO_CA', 'NHAN_VIEN_VAN_HANH', 'FIELD_OPERATOR'];
    const isPrivileged = req.user.roles.some(r => privilegedRoles.includes(r));
    const hasBasePerm = req.user.permissions.includes(permissionCode);
    const hasFallback = 
      (permissionCode.endsWith(':import') && req.user.permissions.includes('GRID_DATA_IMPORT')) ||
      (permissionCode.endsWith(':export') && (req.user.permissions.includes('reports:read') || req.user.permissions.includes('GRID_DATA_IMPORT')));
    const hasPerm = hasBasePerm || hasFallback || isPrivileged;

    if (!isPrivileged && !hasPerm && req.user.roles.includes('KHACH')) {
      recordAuditLog({
        user_id: req.user.id,
        username: req.user.username,
        user_fullname: req.user.full_name,
        action: 'ACCESS_DENIED',
        module: 'PHAN_QUYEN',
        target_id: permissionCode,
        details: `Thiếu quyền bắt buộc: ${permissionCode}`,
        result: 'FAILURE',
        ip_address: req.ip || '127.0.0.1'
      });

      const errorMessage = permissionCode === 'GRID_DATA_IMPORT'
        ? 'Bạn không có quyền Import dữ liệu lưới điện.'
        : `Bạn không có quyền thực hiện thao tác này. (Yêu cầu quyền: ${permissionCode})`;

      return res.status(403).json({
        success: false,
        message: errorMessage
      });
    }

    next();
  };
}

// Middleware to require any of the specified permissions
export function requireAnyPermission(permissionCodes: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    }

    const privilegedRoles = ['ADMIN', 'CAN_BO_PHUONG_THUC', 'TRUONG_CA', 'DOI_TRUONG', 'QUAN_LY', 'LÃNH ĐẠO', 'PHO_CA', 'NHAN_VIEN_VAN_HANH', 'FIELD_OPERATOR'];
    const isPrivileged = req.user.roles.some(r => privilegedRoles.includes(r));
    const hasPerm = permissionCodes.some(code => req.user!.permissions.includes(code)) || isPrivileged;

    if (!isPrivileged && !hasPerm && req.user.roles.includes('KHACH')) {
      recordAuditLog({
        user_id: req.user.id,
        username: req.user.username,
        user_fullname: req.user.full_name,
        action: 'ACCESS_DENIED',
        module: 'PHAN_QUYEN',
        target_id: permissionCodes.join(','),
        details: `Thiếu một trong các quyền bắt buộc: ${permissionCodes.join(', ')}`,
        result: 'FAILURE',
        ip_address: req.ip || '127.0.0.1'
      });

      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền thực hiện thao tác này. (Yêu cầu một trong các quyền: ${permissionCodes.join(', ')})`
      });
    }

    next();
  };
}

import { auditLogRepo } from './repositories/firestore/auditLogRepository';
// ... existing imports ...

// Helper to record audit logs
export function recordAuditLog(log: {
  user_id: number;
  username: string;
  user_fullname: string;
  action: string;
  module: string;
  target_id?: string | number | null;
  details?: string;
  result: 'SUCCESS' | 'FAILURE';
  ip_address?: string;
  requestId?: string;
}) {
  // Write to SQLite
  try {
    dbRun(
      `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.user_id,
        log.username,
        log.user_fullname,
        log.action,
        log.module,
        log.target_id ? String(log.target_id) : null,
        log.details || '',
        log.result,
        log.ip_address || '127.0.0.1'
      ]
    );
  } catch (err) {
    console.error('Failed to write audit log (SQLite):', err);
  }
  
  // Write to Firestore (Production visibility)
  auditLogRepo.create({
    user_id: String(log.user_id),
    username: log.username,
    user_fullname: log.user_fullname,
    action: log.action,
    module: log.module,
    target_id: log.target_id ? String(log.target_id) : null,
    details: log.details,
    result: log.result,
    ip_address: log.ip_address,
    requestId: log.requestId
  }).catch(err => console.error('Failed to write audit log (Firestore):', err));
}

export function requireRole(roleCode: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!req.user.roles.includes(roleCode)) {
      return res.status(403).json({ success: false, message: 'Forbidden. Yêu cầu quyền: ' + roleCode });
    }
    next();
  };
}
