import fetch from 'node-fetch';
async function run() {
  const res = await fetch('http://0.0.0.0:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'testuser',
      password: 'password123'
    })
  });
  console.log(res.status, await res.text());
}
run();
