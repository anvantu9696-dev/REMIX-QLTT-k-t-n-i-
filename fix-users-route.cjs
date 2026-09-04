const fs = require('fs');
let code = fs.readFileSync('server/routes/users.ts', 'utf8');

code = code.replace(/res\.json\(\{ success: true, users \}\);/g, "res.json({ success: true, data: users });");
code = code.replace(/res\.json\(\{ success: true, users, total: users\.length \}\);/g, "res.json({ success: true, data: users, total: users.length });");
code = code.replace(/res\.json\(\{ success: true, user \}\);/g, "res.json({ success: true, data: user });");

fs.writeFileSync('server/routes/users.ts', code);
