const fs = require('fs');

function updateFile(path) {
  let code = fs.readFileSync(path, 'utf8');
  // Change fallback limit from 5000 to 50
  code = code.replace(/const limit = options\?\.limit \|\| 5000;/g, "const limit = options?.limit || 50;");
  code = code.replace(/const limit = Number\(options\?\.limit\) \|\| 5000;/g, "const limit = Number(options?.limit) || 50;");
  fs.writeFileSync(path, code);
}

updateFile('server/repositories/firestore/feederRepository.ts');
updateFile('server/repositories/firestore/deviceRepository.ts');
