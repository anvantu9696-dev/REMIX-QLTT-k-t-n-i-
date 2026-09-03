const fs = require('fs');
const files = [
  'server/repositories/firestore/feederRepository.ts',
  'server/repositories/firestore/deviceRepository.ts',
  'server/repositories/firestore/substationRepository.ts'
];

files.forEach(file => {
  let code = fs.readFileSync(file, 'utf8');
  // Change limit 500 to 50
  code = code.replace(/const limit = options\?\.limit \|\| 500;/g, "const limit = options?.limit || 50;");
  // Change 60000 to 300000
  code = code.replace(/, 60000\)/g, ", 300000)");
  fs.writeFileSync(file, code);
});
console.log('Patched limits and TTLs');
