const fs = require('fs');
let code = fs.readFileSync('server/repositories/firestore/feederRepository.ts', 'utf8');

// Replace the numSubId logic
code = code.replace(
  "    if (subId) {\n      const numSubId = Number(subId);\n      if (!isNaN(numSubId) && String(numSubId) === subId) {\n        query = query.where('substation_id', 'in', [subId, numSubId]);\n      } else {\n        query = query.where('substation_id', '==', subId);\n      }\n    }",
  "    if (subId) {\n      query = query.where('substation_id', '==', String(subId));\n    }"
);

fs.writeFileSync('server/repositories/firestore/feederRepository.ts', code);
console.log('Patched feederRepository.ts');
