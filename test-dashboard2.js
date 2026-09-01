import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
const token = jwt.sign({ userId: 1, username: 'admin', roles: ['ADMIN'] }, 'super-secret-key-for-dev-env-2025');
async function run() {
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
