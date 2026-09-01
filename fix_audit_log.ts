import fs from 'fs';

let content = fs.readFileSync('server/repositories/firestore/auditLogRepository.ts', 'utf8');

content = content.replace(
    /await collection.add\(\{\n\s*\.\.\.log,\n\s*timestamp: new Date\(\),\n\s*\}\);/g,
    `const safeLog: any = { ...log, timestamp: new Date() };\n    Object.keys(safeLog).forEach(key => {\n      if (safeLog[key] === undefined) delete safeLog[key];\n    });\n    await collection.add(safeLog);`
);

fs.writeFileSync('server/repositories/firestore/auditLogRepository.ts', content);
