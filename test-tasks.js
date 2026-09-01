import fetch from 'node-fetch';
async function run() {
  const loginRes = await fetch('http://0.0.0.0:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'password123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  const res = await fetch('http://0.0.0.0:3000/api/tasks?status=PENDING_APPROVAL', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(res.status, await res.text());
}
run();
