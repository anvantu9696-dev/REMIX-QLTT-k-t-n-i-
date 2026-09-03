import { invalidateCache } from '../utils/firestoreCache';
import { Router } from 'express';
import { authenticateToken, denyGuestMutations, requireRole, recordAuditLog, AuthenticatedRequest } from '../middleware.js';
import { getTargetFirestore, getTargetAuth } from '../firebaseAdmin.js';

const router = Router();
const PROTECTED_EMAIL = 'anvantu9696@gmail.com';

router.use(authenticateToken);
router.use(denyGuestMutations);

router.use((req, res, next) => {
  console.log(`[Users API] ${req.method} ${req.originalUrl}`);
  next();
});


async function findUserByEmail(email: string) {
  const snapshot = await getTargetFirestore().collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

async function findUserById(id: string) {
  const doc = await getTargetFirestore().collection('users').doc(id).get();
  if (!doc.exists) {
    const snapshot = await getTargetFirestore().collection('users').where('id', '==', id).limit(1).get();
    if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    return null;
  }
  return { id: doc.id, ...doc.data() };
}

router.get('/assignable', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const snapshot = await getTargetFirestore().collection('users')
      .where('role', '==', 'STAFF')
      .where('status', '==', 'ACTIVE')
      .where('deleted_at', '==', null)
      .get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

router.get('/pending', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const snapshot = await getTargetFirestore().collection('users').where('status', '==', 'PENDING').where('deleted_at', '==', null).get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

router.patch('/sync/status', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { email, status, uid } = req.body;
  if (!email || !uid) return res.status(400).json({ success: false, message: 'Missing email or uid' });
  if (email === PROTECTED_EMAIL && status !== 'ACTIVE') {
    return res.status(403).json({ success: false, message: 'Tài khoản quản trị chính không thể bị khóa.' });
  }
  try {
    const userRef = getTargetFirestore().collection('users').doc(uid);
    await userRef.update({
      status,
      isActive: status === 'ACTIVE',
      updatedAt: new Date().toISOString()
    });
    invalidateCache(`user_profile_${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.patch('/sync/role', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { email, role, uid } = req.body;
  if (!email || !uid) return res.status(400).json({ success: false, message: 'Missing email or uid' });
  if (email === PROTECTED_EMAIL && role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Tài khoản quản trị chính không thể bị thay đổi quyền.' });
  }
  try {
    const userRef = getTargetFirestore().collection('users').doc(uid);
    await userRef.update({
      role,
      roles: [role],
      updatedAt: new Date().toISOString()
    });
    invalidateCache(`user_profile_${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.delete('/sync/delete', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { email, uid } = req.body;
  if (!email || !uid) return res.status(400).json({ success: false, message: 'Missing email or uid' });
  if (email === PROTECTED_EMAIL) return res.status(403).json({ success: false, message: 'Không thể xóa tài khoản quản trị chính.' });
  try {
    await getTargetFirestore().collection('users').doc(uid).update({ deleted_at: new Date().toISOString() });
    invalidateCache(`user_profile_${uid}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.get('/', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const { search, role, status } = req.query;
    let query: any = getTargetFirestore().collection('users').where('deleted_at', '==', null);
    if (status) query = query.where('status', '==', status);
    if (role) query = query.where('role', '==', role);
    
    const snapshot = await query.get();
    let users = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    
    if (search) {
      const s = (search as string).toLowerCase();
      users = users.filter((u: any) => 
        (u.full_name || '').toLowerCase().includes(s) || 
        (u.username || '').toLowerCase().includes(s) || 
        (u.email || '').toLowerCase().includes(s) ||
        (u.employee_code || '').toLowerCase().includes(s)
      );
    }
    
    res.json({ success: true, users, total: users.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

router.get('/:id', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user || (user as any).deleted_at) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

router.post('/', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { username, email, full_name, role, status } = req.body;
  try {
    const existing = await findUserByEmail(email);
    if (existing) return res.status(400).json({ success: false, message: 'Email đã tồn tại' });
    
    const newUser = {
      username,
      email: email.toLowerCase(),
      full_name,
      role: role || 'VIEWER',
      roles: [role || 'VIEWER'],
      status: status || 'ACTIVE',
      isActive: (status || 'ACTIVE') === 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const docRef = await getTargetFirestore().collection('users').add(newUser);
    res.json({ success: true, message: 'Tạo thành công', user: { id: docRef.id, ...newUser } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

router.put('/:id/change-password', async (req: AuthenticatedRequest, res) => {
  res.json({ success: true, message: 'Password change not supported in Firestore-only mode' });
});

router.put('/:id', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { full_name, phone, unit, team, title } = req.body;
  try {
    const user = await findUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false });
    const userRef = getTargetFirestore().collection('users').doc(user.id);
    await userRef.update({
      full_name, phone, unit, team, title,
      updatedAt: new Date().toISOString()
    });
    invalidateCache(`user_profile_${req.params.id}`);
    res.json({ success: true, message: 'Đã cập nhật' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

router.patch('/:id/approve', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false });
    await getTargetFirestore().collection('users').doc(user.id).update({
      status: 'ACTIVE', isActive: true, updatedAt: new Date().toISOString()
    });
    res.json({ success: true, message: 'Đã phê duyệt' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

router.patch('/:id/reject', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false });
    await getTargetFirestore().collection('users').doc(user.id).update({
      status: 'REJECTED', isActive: false, updatedAt: new Date().toISOString()
    });
    res.json({ success: true, message: 'Đã từ chối' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

router.patch('/:id/lock', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { locked } = req.body;
  const status = locked ? 'LOCKED' : 'ACTIVE';
  try {
    const user = await findUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false });
    await getTargetFirestore().collection('users').doc(user.id).update({
      status, isActive: !locked, updatedAt: new Date().toISOString()
    });
    res.json({ success: true, message: locked ? 'Đã khóa' : 'Đã mở khóa' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

router.put('/:id/role', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { role } = req.body;
  try {
    const user = await findUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false });
    await getTargetFirestore().collection('users').doc(user.id).update({
      role, roles: [role], updatedAt: new Date().toISOString()
    });
    res.json({ success: true, message: 'Đã cập nhật role' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

router.patch('/:id/role', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { roles } = req.body;
  const role = Array.isArray(roles) && roles.length > 0 ? roles[0] : 'VIEWER';
  try {
    const user = await findUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false });
    await getTargetFirestore().collection('users').doc(user.id).update({
      role, roles: [role], updatedAt: new Date().toISOString()
    });
    res.json({ success: true, message: 'Đã cập nhật role' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

router.patch('/:id/status', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { status } = req.body;
  try {
    const user = await findUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false });
    await getTargetFirestore().collection('users').doc(user.id).update({
      status, isActive: status === 'ACTIVE', updatedAt: new Date().toISOString()
    });
    res.json({ success: true, message: 'Đã cập nhật status' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

router.delete('/:id', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false });
    await getTargetFirestore().collection('users').doc(user.id).update({ deleted_at: new Date().toISOString() });
    invalidateCache(`user_profile_${user.id}`);
    res.json({ success: true, message: 'Đã xóa' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});

export default router;
