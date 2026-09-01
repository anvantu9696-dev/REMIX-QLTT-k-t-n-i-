fetch('http://localhost:3000/api/users', { headers: { 'Authorization': 'Bearer ' + process.env.TOKEN } }).then(r=>r.json()).then(console.log);
