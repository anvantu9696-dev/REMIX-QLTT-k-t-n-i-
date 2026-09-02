import { Request, Response, NextFunction } from 'express';
import { getTargetFirestore, getTargetAuth } from './firebaseAdmin.js';
import { auditLogRepo } from './repositories/firestore/auditLogRepository.js';

export interface AuthenticatedUser {
  id: string | number;
  username: string;
  employee_code: string;
  full_name: string;
  email: string;
  unit: string;
  team: string;
  title: string;
  status: string;
  roles: string[];
  scopes?: { scope_type: string; scope_value: string }[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
     return res.status(401).json({ success: false, errorType: 'TOKEN_INVALID', message: 'Yêu cầu đăng nhập để truy cập hệ thống' });
  }

  try {
    const auth = getTargetAuth();
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (e: any) {
      if (e.code === 'auth/id-token-expired') return res.status(401).json({ success: false, errorType: 'TOKEN_EXPIRED', message: 'Token đã hết hạn' });
      return res.status(401).json({ success: false, errorType: 'TOKEN_INVALID', message: 'Token không hợp lệ' });
    }
    
    const db = getTargetFirestore();
    const uid = decodedToken.uid;
    const doc = await db.collection('users').doc(uid).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, errorType: 'PROFILE_NOT_FOUND', message: 'Không tìm thấy hồ sơ người dùng.' });
    }

    const userRow = doc.data() as any;
    userRow.id = doc.id;

    if (userRow.status === 'PENDING') {
      return res.status(403).json({ success: false, errorType: 'USER_PENDING', message: 'Tài khoản đang chờ duyệt.' });
    }
    if (userRow.status === 'DISABLED') {
      return res.status(403).json({ success: false, errorType: 'USER_DISABLED', message: 'Tài khoản đã bị vô hiệu hóa.' });
    }
    if (userRow.status === 'LOCKED') {
      return res.status(403).json({ success: false, errorType: 'USER_LOCKED', message: 'Tài khoản đang bị tạm khóa.' });
    }

    // Single role from userRow.role or fallback
    let role = userRow.role;
    if (!role && Array.isArray(userRow.roles) && userRow.roles.length > 0) {
       role = userRow.roles[0];
    }
    if (!['ADMIN', 'MANAGER', 'SHIFT_LEADER', 'STAFF', 'VIEWER'].includes(role)) {
       role = 'VIEWER'; // fallback strict
    }

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
      roles: [role]
    };

    next();
  } catch (err: any) {
    console.error('authenticateToken error:', err);
    return res.status(500).json({ success: false, errorType: 'SERVER_ERROR', message: 'Lỗi máy chủ nội bộ' });
  }
}

export function denyGuestMutations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ success: false, errorType: 'TOKEN_INVALID', message: 'Chưa đăng nhập' });
  const isOnlyGuest = req.user.roles.includes('VIEWER') && !req.user.roles.some(r => ['ADMIN', 'MANAGER', 'SHIFT_LEADER', 'STAFF'].includes(r));
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());

  if (isOnlyGuest && isMutating) {
    recordAuditLog({
      user_id: req.user.id,
      username: req.user.username,
      user_fullname: req.user.full_name,
      action: `${req.method} ${req.originalUrl}`,
      module: 'PHAN_QUYEN',
      target_id: null,
      details: 'Cố gắng thực hiện thao tác ghi/xóa với quyền VIEWER (Bị chặn)',
      result: 'FAILURE',
      ip_address: req.ip || '127.0.0.1'
    });
    return res.status(403).json({
      success: false,
      errorType: 'FORBIDDEN',
      message: 'Tài khoản VIEWER chỉ có quyền XEM (Read-only).'
    });
  }
  next();
}

export function requirePermission(permissionCode: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, errorType: 'TOKEN_INVALID', message: 'Chưa đăng nhập' });
    const hasPerm = req.user.roles.includes('ADMIN') || req.user.roles.includes('MANAGER');
    if (!hasPerm) {
      return res.status(403).json({ success: false, errorType: 'FORBIDDEN', message: `Yêu cầu quyền: ${permissionCode}` });
    }
    next();
  };
}

export function requireAnyPermission(permissionCodes: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, errorType: 'TOKEN_INVALID', message: 'Chưa đăng nhập' });
    const hasPerm = req.user.roles.includes('ADMIN') || req.user.roles.includes('MANAGER');
    if (!hasPerm) {
      return res.status(403).json({ success: false, errorType: 'FORBIDDEN', message: `Yêu cầu quyền: ${permissionCodes.join(', ')}` });
    }
    next();
  };
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, errorType: 'TOKEN_INVALID', message: 'Chưa đăng nhập' });
    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
    if (!hasRole && !req.user.roles.includes('ADMIN')) {
      return res.status(403).json({
        success: false,
        errorType: 'FORBIDDEN',
        message: 'Bạn không có quyền thực hiện thao tác này.'
      });
    }
    next();
  };
}

export function recordAuditLog(
  arg1: any, arg2?: any, arg3?: any, arg4?: any, arg5?: any, arg6?: any, arg7?: any, arg8?: any, arg9?: any
) {
  let log: any;
  if (typeof arg1 === 'object' && arg1 !== null) {
    log = arg1;
  } else {
    log = {
      user_id: arg1,
      username: arg2,
      user_fullname: arg3,
      action: arg4,
      module: arg5,
      target_id: arg6,
      details: arg7,
      result: arg8,
      ip_address: arg9
    };
  }
  
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
