import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
// Create user first
async function run() {
  await fetch('http://0.0.0.0:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: 'Admin',
      username: 'admin2',
      email: 'admin2@example.com',
      unit: 'EVN',
      password: 'password123',
      confirmPassword: 'password123'
    })
  });
  // The sqlite database needs to have the user.
  // Actually, I can just use the login endpoint to see if any user exists, but my user is PENDING.
  // Wait, I can generate a token with a known ID. Let's just assume ID 1 exists.
  const token = jwt.sign({ userId: 1, username: 'admin' }, 'quan_ly_thiet_bi_luoi_dien_secret_key_2026');
  
  const urls = [
    '/api/dashboard/stats',
    '/api/tasks?status=PENDING_APPROVAL',
    '/api/audit-logs?limit=6',
    '/api/devices'
  ];
  for (const url of urls) {
    const res = await fetch('http://0.0.0.0:3000' + url, { headers: { 'Authorization': `Bearer ${token}` } });
    console.log(url, res.status, (await res.text()).substring(0, 100));
  }
}
run();
