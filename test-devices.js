import fetch from 'node-fetch';
const token = process.env.TOKEN || 'put-token-here';
async function run() {
  const res = await fetch('http://0.0.0.0:3000/api/devices', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(res.status, await res.text());
}
run();
