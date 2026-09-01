const fs = require('fs');
const content = `import { Router } from 'express';
import { dbQuery, dbQueryOne, dbRun } from '../db';
import { authenticateToken, recordAuditLog, AuthenticatedRequest } from '../middleware';
import { getTargetFirestore, getTargetAuth } from '../firebaseAdmin.js';

const router = Router();
const DEFAULT_ADMIN_EMAIL = 'anvantu9696@gmail.com';

// Sync user from Firebase to local DB
router.post('/sync', async (req, res) => {
  const { idToken, full_name, photoURL } = req.body;
  if (!idToken) {
    return res.status(400).json({ success: false, message: 'Thiếu ID Token' });
  }

  try {
    const auth = getTargetAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    const google_uid = decodedToken.uid;
    const email = decodedToken.email;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Token không chứa email' });
    }

    // Check if this is the first user or default admin
    const anyAdmin = dbQueryOne("SELECT u.id FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE r.code = 'ADMIN'");
    const isFirstAdmin = !anyAdmin || email.toLowerCase().trim() === DEFAULT_ADMIN_EMAIL.toLowerCase();

    // Ensure user exists in SQLite
    let sqliteUser = dbQueryOne(\`
      SELECT u.id, u.status, u.username, u.full_name, r.code as roleCode
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.email = ? AND u.deleted_at IS NULL
    \`, [email]);

    let username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (!sqliteUser) {
      // Check if duplicate exists (maybe deleted)
      const anyUser = dbQueryOne(\`SELECT id FROM users WHERE email = ?\`, [email]);
      if (anyUser) {
        dbRun(\`UPDATE users SET deleted_at = NULL, status = 'ACTIVE' WHERE id = ?\`, [anyUser.id]);
        sqliteUser = dbQueryOne(\`SELECT u.id, u.status, u.username, u.full_name, r.code as roleCode FROM users u LEFT JOIN user_roles ur ON u.id = ur.user_id LEFT JOIN roles r ON ur.role_id = r.id WHERE u.email = ? AND u.deleted_at IS NULL\`, [email]);
      } else {
        const status = isFirstAdmin ? 'ACTIVE' : 'PENDING';
        const role = isFirstAdmin ? 'ADMIN' : 'VIEWER';
        
        let usernameExists = dbQueryOne(\`SELECT id FROM users WHERE username = ?\`, [username]);
        if (usernameExists) {
          username = \`\${username}_\${Math.floor(Math.random() * 10000)}\`;
        }
        
        dbRun(
          \`INSERT INTO users (employee_code, full_name, username, email, unit, team, title, status, password_hash, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'FIREBASE_AUTH', 'FIREBASE_AUTH')\`,
          [\`FB-\${google_uid.slice(0, 6)}\`, full_name || username, username, email, 'EVN', 'Đội Vận hành', 'Nhân viên', status, 'firebase_managed']
        );
        
        const newUser = dbQueryOne(\`SELECT id FROM users WHERE email = ?\`, [email]);
        if (newUser) {
          const roleRow = dbQueryOne(\`SELECT id FROM roles WHERE code = ?\`, [role]);
          if (roleRow) {
             dbRun(\`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)\`, [newUser.id, roleRow.id]);
          }
          if (isFirstAdmin) {
            // Assign TOAN_HE_THONG scope
            dbRun(\`INSERT INTO user_scopes (user_id, scope_type, scope_value) VALUES (?, 'SYSTEM', 'TOAN_HE_THONG')\`, [newUser.id]);
          }
        }
        
        sqliteUser = dbQueryOne(\`
          SELECT u.id, u.status, u.username, u.full_name, r.code as roleCode
          FROM users u
          LEFT JOIN user_roles ur ON u.id = ur.user_id
          LEFT JOIN roles r ON ur.role_id = r.id
          WHERE u.email = ? AND u.deleted_at IS NULL
        \`, [email]);
      }
    }

    if (!sqliteUser) {
       return res.status(500).json({ success: false, message: 'Không thể tạo tài khoản.' });
    }

    const currentRole = sqliteUser.roleCode || 'VIEWER';
    const currentStatus = sqliteUser.status;

    // Sync to Firestore
    const db = getTargetFirestore();
    const userRef = db.collection('users').doc(google_uid);
    const userDoc = await userRef.get();
    
    const firestoreData: any = {
      uid: google_uid,
      employee_code: \`FB-\${google_uid.slice(0, 6)}\`,
      username: sqliteUser.username,
      full_name: full_name || sqliteUser.full_name,
      email: email.trim(),
      role: currentRole,
      roles: [currentRole],
      status: currentStatus,
      isActive: currentStatus === 'ACTIVE',
      authProvider: 'firebase',
      photoURL: photoURL || '',
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    
    if (!userDoc.exists) {
      firestoreData.createdAt = new Date().toISOString();
      await userRef.set(firestoreData);
    } else {
      await userRef.update(firestoreData);
    }

    // Access control checks
    if (currentStatus === 'LOCKED' || currentStatus === 'DISABLED') {
      return res.status(403).json({ success: false, status: currentStatus, message: 'Tài khoản của bạn đang bị khóa hoặc vô hiệu hóa.' });
    }

    if (currentStatus === 'PENDING') {
      return res.status(403).json({ success: false, status: 'PENDING', message: 'Tài khoản đang chờ Admin duyệt.' });
    }

    // Get Permissions
    const permRows = dbQuery(
      \`SELECT DISTINCT p.code FROM user_roles ur 
       JOIN role_permissions rp ON ur.role_id = rp.role_id 
       JOIN permissions p ON rp.permission_id = p.id 
       WHERE ur.user_id = ?\`,
      [sqliteUser.id]
    );
    const permissions = permRows.map(p => p.code);

    const scopeRows = dbQuery(
      \`SELECT scope_type, scope_value FROM user_scopes WHERE user_id = ?\`,
      [sqliteUser.id]
    );

    const roles = [currentRole];
    
    recordAuditLog({
      user_id: sqliteUser.id,
      username: sqliteUser.username,
      user_fullname: sqliteUser.full_name,
      action: 'FIREBASE_LOGIN',
      module: 'XAC_THUC',
      details: \`Đăng nhập thành công (\${email}) với UID: \${google_uid}\`,
      result: 'SUCCESS',
      ip_address: req.ip
    });

    return res.json({
      success: true,
      message: 'Đăng nhập thành công',
      user: {
        ...sqliteUser,
        id: google_uid,
        roles,
        scopes: scopeRows
      },
      permissions
    });

  } catch (err: any) {
    console.error('Login sync error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Lỗi xử lý đồng bộ' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  return res.json({
    success: true,
    user: req.user,
    permissions: req.user?.permissions
  });
});

export default router;
`;
fs.writeFileSync('server/routes/auth.ts', content);
