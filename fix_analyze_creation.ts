import fs from 'fs';

let content = fs.readFileSync('server/routes/import.ts', 'utf8');

// Replace auto create substation in analyze
content = content.replace(
  /dbRun\(\n\s*`INSERT INTO substations \(substation_code, name, status\) VALUES \(\?, \?, 'ACTIVE'\)`,\n\s*\[substationQuery, substationQuery\]\n\s*\);\n\s*const newSub = dbQueryOne\(\n\s*`SELECT id, substation_code, name FROM substations WHERE substation_code = \? OR name = \? ORDER BY id DESC LIMIT 1`,\n\s*\[substationQuery, substationQuery\]\n\s*\);/g,
  `let newSub: any = null;\n        if (CORE_DATA_SOURCE === 'firestore') {\n          newSub = await substationRepo.create({ substation_code: substationQuery, name: substationQuery, status: 'ACTIVE' }, 'AUTO_IMPORT');\n        } else {\n          dbRun(\n            \`INSERT INTO substations (substation_code, name, status) VALUES (?, ?, 'ACTIVE')\`,\n            [substationQuery, substationQuery]\n          );\n          newSub = dbQueryOne(\n            \`SELECT id, substation_code, name FROM substations WHERE substation_code = ? OR name = ? ORDER BY id DESC LIMIT 1\`,\n            [substationQuery, substationQuery]\n          );\n        }`
);

// Replace auto create feeder in analyze
content = content.replace(
  /dbRun\(\n\s*`INSERT INTO feeders \(feeder_code, name, substation_id, status\) VALUES \(\?, \?, \?, 'ACTIVE'\)`,\n\s*\[feederQuery, feederQuery, substationId \|\| 1\]\n\s*\);\n\s*const newFeeder = dbQueryOne\(\n\s*`SELECT id, feeder_code, name, substation_id FROM feeders WHERE feeder_code = \? OR name = \? ORDER BY id DESC LIMIT 1`,\n\s*\[feederQuery, feederQuery\]\n\s*\);/g,
  `let newFeeder: any = null;\n        if (CORE_DATA_SOURCE === 'firestore') {\n          newFeeder = await feederRepo.create({ feeder_code: feederQuery, name: feederQuery, substation_id: String(substationId), status: 'ACTIVE', createdBy: 'IMPORT_AUTO', updatedBy: 'IMPORT_AUTO' }, 'AUTO_IMPORT');\n        } else {\n          dbRun(\n            \`INSERT INTO feeders (feeder_code, name, substation_id, status) VALUES (?, ?, ?, 'ACTIVE')\`,\n            [feederQuery, feederQuery, substationId || 1]\n          );\n          newFeeder = dbQueryOne(\n            \`SELECT id, feeder_code, name, substation_id FROM feeders WHERE feeder_code = ? OR name = ? ORDER BY id DESC LIMIT 1\`,\n            [feederQuery, feederQuery]\n          );\n        }`
);

fs.writeFileSync('server/routes/import.ts', content);
