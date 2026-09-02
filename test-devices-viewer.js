import fetch from 'node-fetch';

async function run() {
  const loginRes = await fetch('http://localhost:3000/api/auth/guest-config');
  const loginData = await loginRes.json();
  console.log("Guest config:", loginData.email);

  // Now we need the Firebase JWT for guest@scada.com
  // I will just use the token API from identitytoolkit if possible
  const apiKey = process.env.GEMINI_API_KEY; // Actually we need Firebase Web API Key
}
run();
