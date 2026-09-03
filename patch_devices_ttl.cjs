const fs = require('fs');
let code = fs.readFileSync('server/repositories/firestore/deviceRepository.ts', 'utf8');

code = code.replace(/const limit = options\?\.limit \|\| 10;/g, "const limit = options?.limit || 50;");
code = code.replace(/, 30000\)/g, ", 300000)");

fs.writeFileSync('server/repositories/firestore/deviceRepository.ts', code);
console.log('Patched device TTLs');
