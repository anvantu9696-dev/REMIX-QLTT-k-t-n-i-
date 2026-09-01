import fs from 'fs';

let content = fs.readFileSync('server/routes/import.ts', 'utf8');

// Replace rows.forEach((row, idx) => { with for (let idx = 0; idx < rows.length; idx++) { const row = rows[idx];
// Wait, I have to be careful with the closing `});`
// Since I know exactly the lines, I'll use regex.
content = content.replace(/rows\.forEach\(\(row, idx\) => \{/g, 'for (let idx = 0; idx < rows.length; idx++) { const row = rows[idx];');
// Now replace the `});` that ends these two loops.
// The first one is right before `let importedCount = 0;` (around line 235)
// The second one is right before `fileDeviceIdMap.forEach((indices, devId) => {` (around line 669)

content = content.replace(/    \}\);\n\n    let importedCount = 0;/g, '    }\n\n    let importedCount = 0;');
content = content.replace(/    \}\);\n\n    fileDeviceIdMap\.forEach/g, '    }\n\n    fileDeviceIdMap.forEach');
content = content.replace(/    \}\);\n\n  let importedCount = 0;/g, '    }\n\n  let importedCount = 0;');
content = content.replace(/  \}\);\n\n  let importedCount = 0;/g, '  }\n\n  let importedCount = 0;');
content = content.replace(/  \}\);\n\n  fileDeviceIdMap\.forEach/g, '  }\n\n  fileDeviceIdMap.forEach');

// Fix feeder create input missing createdBy, updatedBy
content = content.replace(
    /feederRepo\.create\(\{ feeder_code: feederCode, name: feederCode, substation_id: String\(substationId\), status: 'ACTIVE' \}, 'AUTO_IMPORT'\)/g,
    `feederRepo.create({ feeder_code: feederCode, name: feederCode, substation_id: String(substationId), status: 'ACTIVE', createdBy: 'IMPORT_AUTO', updatedBy: 'IMPORT_AUTO' }, 'AUTO_IMPORT')`
);

fs.writeFileSync('server/routes/import.ts', content);
