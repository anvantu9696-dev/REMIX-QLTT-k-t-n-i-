import fetch from 'node-fetch';
async function run() {
  const res = await fetch('http://0.0.0.0:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: 'Test',
      username: 'testuser',
      email: 'test@example.com',
      unit: 'EVN',
      password: 'password123',
      confirmPassword: 'password123'
    })
  });
  console.log(res.status, await res.text());
}
run();
