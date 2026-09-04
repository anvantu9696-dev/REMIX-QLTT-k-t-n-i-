import { Router } from 'express';
import { authenticateToken, recordAuditLog, AuthenticatedRequest } from '../middleware.js';
import { getTargetFirestore, getTargetAuth } from '../firebaseAdmin.js';
import { invalidateCache } from '../utils/firestoreCache.js';

const router = Router();

// Sync user from Firebase to Firestore
router.post('/sync', async (req, res) => {
  const { idToken, full_name, photoURL } = req.body;
  if (!idToken) {
    return res.status(400).json({ success: false, message: 'Thiếu ID Token' });
  }

  try {
    const auth = getTargetAuth();
    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(idToken);
    } catch (e: any) {
        if (e.code === 'auth/id-token-expired') return res.status(401).json({ success: false, errorType: 'TOKEN_EXPIRED', message: 'Token đã hết hạn' });
        return res.status(401).json({ success: false, errorType: 'TOKEN_INVALID', message: 'Token không hợp lệ' });
    }
    
    const firebase_uid = decodedToken.uid;
    const isAnonymous = decodedToken.provider_id === 'anonymous' || !decodedToken.email;
    const email = decodedToken.email?.toLowerCase() || `guest_${firebase_uid}@anonymous.local`;

    const db = getTargetFirestore();
    let username = isAnonymous ? `guest_${firebase_uid.slice(0, 8)}` : email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    const userRef = db.collection('users').doc(firebase_uid);
    const userDoc = await userRef.get();

    let userData;
    if (!userDoc.exists) {
      // 6. REGISTER: role: VIEWER, status: ACTIVE for guest, PENDING for normal
      const status = isAnonymous ? 'ACTIVE' : 'PENDING';
      const role = 'VIEWER';
      
      let finalUsername = username;
      const usernameSnapshot = await db.collection('users').where('username', '==', finalUsername).limit(1).get();
      if (!usernameSnapshot.empty) {
        finalUsername = `${finalUsername}_${Math.floor(Math.random() * 10000)}`;
      }

      userData = {
        uid: firebase_uid,
        employee_code: `FB-${firebase_uid.slice(0, 6)}`,
        username: finalUsername,
        full_name: full_name || finalUsername,
        email: email.trim(),
        role: role,
        roles: [role],
        status: status,
        isActive: isAnonymous ? true : false,
        authProvider: 'firebase',
        photoURL: photoURL || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        deleted_at: null
      };

      try {
          await userRef.set(userData);
      } catch (writeErr) {
          // Rollback if Firestore write fails
          // Do not delete Auth user if Firestore fails temporarily
          return res.status(500).json({ success: false, errorType: 'SERVER_ERROR', message: 'Lỗi ghi cơ sở dữ liệu. Vui lòng thử lại sau.' });
      }
    } else {
      userData = userDoc.data();
      await userRef.update({
        full_name: full_name || userData.full_name,
        photoURL: photoURL || '',
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      });
      userData.full_name = full_name || userData.full_name;
      userData.photoURL = photoURL || '';
    }

    const currentStatus = userData.status || 'PENDING';

    // Allow PENDING to return 200 so PendingGuard can display the UI
    /* if (currentStatus === 'PENDING') {
      return res.status(403).json({ success: false, errorType: 'USER_PENDING', message: 'Tài khoản đang chờ duyệt.' });
    } */
    if (currentStatus === 'DISABLED') {
      return res.status(403).json({ success: false, errorType: 'USER_DISABLED', message: 'Tài khoản đã bị vô hiệu hóa.' });
    }
    if (currentStatus === 'LOCKED') {
      return res.status(403).json({ success: false, errorType: 'USER_LOCKED', message: 'Tài khoản đang bị tạm khóa.' });
    }

    recordAuditLog({
      user_id: firebase_uid as any,
      username: userData.username,
      user_fullname: userData.full_name,
      action: 'FIREBASE_LOGIN',
      module: 'XAC_THUC',
      details: `Đăng nhập thành công (${email}) với UID: ${firebase_uid}`,
      result: 'SUCCESS',
      ip_address: req.ip
    });

    return res.json({
      success: true,
      message: 'Đăng nhập thành công',
      user: {
        ...userData,
        id: firebase_uid
      }
    });

  } catch (err: any) {
    console.error('Login sync error:', err);
    return res.status(500).json({ success: false, errorType: 'SERVER_ERROR', message: err.message || 'Lỗi hệ thống' });
  }
});

router.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  return res.json({
    success: true,
    user: req.user,
  });
});

router.get('/guest-config', (req, res) => {
  const email = process.env.GUEST_EMAIL || 'guest@scada.com';
  const password = process.env.GUEST_PASSWORD || 'GuestPassword123!';
  return res.json({ success: true, email, password });
});


router.post('/logout', authenticateToken, (req: AuthenticatedRequest, res) => {
  if (req.user && req.user.id) {
    invalidateCache(`user_profile_${req.user.id}`);
  }
  return res.json({ success: true, message: 'Đăng xuất thành công' });
});

export default router;
