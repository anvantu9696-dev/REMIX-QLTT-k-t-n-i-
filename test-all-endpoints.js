import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
const token = jwt.sign({ userId: 1, username: 'admin' }, 'quan_ly_thiet_bi_luoi_dien_secret_key_2026');

async function testEndpoint(url) {
  try {
    const res = await fetch('http://0.0.0.0:3000' + url, { headers: { 'Authorization': `Bearer ${token}` } });
    const text = await res.text();
    if (res.status === 400) {
      console.log(`[400 FOUND] ${url}: ${text}`);
    } else {
      console.log(`[${res.status}] ${url}`);
    }
  } catch (e) {
    console.log(`[ERROR] ${url}: ${e.message}`);
  }
}

async function run() {
  const endpoints = [
    '/api/users/me',
    '/api/settings',
    '/api/notifications',
    '/api/messages',
    '/api/auth/me',
    '/api/profile'
  ];
  for (const ep of endpoints) {
    await testEndpoint(ep);
  }
}
run();
