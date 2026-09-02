import fetch from 'node-fetch';
async function test() {
  const loginRes = await fetch('http://localhost:3000/api/auth/guest-config');
  const loginData = await loginRes.json();
  const token = "we need a firebase token"; 
}
