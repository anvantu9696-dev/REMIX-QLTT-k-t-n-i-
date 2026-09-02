const fs = require('fs');
let content = fs.readFileSync('server/routes/devices.ts', 'utf8');

const findStr = `            substationRepo.list(),
            feederRepo.list()`;

const replaceStr = `            substationRepo.list({ limit: 100 }),
            feederRepo.list({ limit: 100 })`;

content = content.replace(findStr, replaceStr);

fs.writeFileSync('server/routes/devices.ts', content);
