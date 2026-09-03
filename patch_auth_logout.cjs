const fs = require('fs');
let code = fs.readFileSync('server/routes/auth.ts', 'utf8');

if (!code.includes('/logout')) {
    const logoutRoute = `
router.post('/logout', authenticateToken, (req: AuthenticatedRequest, res) => {
  if (req.user && req.user.id) {
    const { invalidateCache } = require('../utils/firestoreCache');
    invalidateCache(\`user_profile_\${req.user.id}\`);
  }
  return res.json({ success: true, message: 'Đăng xuất thành công' });
});
`;
    code = code.replace(/export default router;/, logoutRoute + '\nexport default router;');
    fs.writeFileSync('server/routes/auth.ts', code);
    console.log('Patched auth route to include /logout');
}
