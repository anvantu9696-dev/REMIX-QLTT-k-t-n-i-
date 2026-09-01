fetch('http://localhost:3000/api/checklists/sync-evn', { method: 'POST', headers: { 'Authorization': 'Bearer ' + process.env.TOKEN } }).then(r=>r.json()).then(console.log);
