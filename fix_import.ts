import fs from 'fs';

let content = fs.readFileSync('server/routes/import.ts', 'utf8');

// Fix 1: Map initialization
content = content.replace(
  /const substations = dbQuery\(`SELECT id, substation_code, name FROM substations WHERE deleted_at IS NULL`\);\n\s*const substationMap = new Map<string, { id: number; name: string }>\(\);/g,
  `let substations: any[] = [];\n  let feeders: any[] = [];\n  if (CORE_DATA_SOURCE === 'firestore') {\n    substations = await substationRepo.list();\n    feeders = await feederRepo.list();\n  } else {\n    substations = dbQuery(\`SELECT id, substation_code, name FROM substations WHERE deleted_at IS NULL\`);\n    feeders = dbQuery(\`SELECT id, feeder_code, name FROM feeders WHERE deleted_at IS NULL\`);\n  }\n\n  const substationMap = new Map<string, { id: any; name: string }>();`
);

content = content.replace(
  /const feeders = dbQuery\(`SELECT id, feeder_code, name FROM feeders WHERE deleted_at IS NULL`\);\n\s*const feederMap = new Map<string, { id: number; name: string; substation_id: number }>\(\);/g,
  `const feederMap = new Map<string, { id: any; name: string; substation_id: any }>();`
);


// Fix 2: subByName / auto create substation
content = content.replace(
  /const subByName = dbQueryOne\(`SELECT id, substation_code, name FROM substations WHERE LOWER\(name\) = LOWER\(\?\) LIMIT 1`, \[substationCode\]\);/g,
  `let subByName: any = null;\n        if (CORE_DATA_SOURCE === 'firestore') {\n          subByName = substations.find(s => (s.name || '').toLowerCase() === substationCode.toLowerCase());\n        } else {\n          subByName = dbQueryOne(\`SELECT id, substation_code, name FROM substations WHERE LOWER(name) = LOWER(?) LIMIT 1\`, [substationCode]);\n        }`
);

content = content.replace(
  /dbRun\(\n\s*`INSERT INTO substations \(substation_code, name, status, created_by\) VALUES \(\?, \?, 'ACTIVE', 'IMPORT_AUTO'\)`,\n\s*\[substationCode, substationCode\]\n\s*\);\n\s*const newSub = dbQueryOne\(\n\s*`SELECT id FROM substations WHERE substation_code = \? LIMIT 1`,\n\s*\[substationCode\]\n\s*\);/g,
  `let newSub: any = null;\n        if (CORE_DATA_SOURCE === 'firestore') {\n          newSub = await substationRepo.create({ substation_code: substationCode, name: substationCode, status: 'ACTIVE' }, 'AUTO_IMPORT');\n        } else {\n          dbRun(\n            \`INSERT INTO substations (substation_code, name, status, created_by) VALUES (?, ?, 'ACTIVE', 'IMPORT_AUTO')\`,\n            [substationCode, substationCode]\n          );\n          newSub = dbQueryOne(\n            \`SELECT id FROM substations WHERE substation_code = ? LIMIT 1\`,\n            [substationCode]\n          );\n        }`
);

// Fix 3: feederByName / auto create feeder
content = content.replace(
  /const feederByName = dbQueryOne\(`SELECT id, feeder_code, name, substation_id FROM feeders WHERE LOWER\(name\) = LOWER\(\?\) LIMIT 1`, \[feederCode\]\);/g,
  `let feederByName: any = null;\n        if (CORE_DATA_SOURCE === 'firestore') {\n          feederByName = feeders.find(f => (f.name || '').toLowerCase() === feederCode.toLowerCase());\n        } else {\n          feederByName = dbQueryOne(\`SELECT id, feeder_code, name, substation_id FROM feeders WHERE LOWER(name) = LOWER(?) LIMIT 1\`, [feederCode]);\n        }`
);

content = content.replace(
  /dbRun\(\n\s*`INSERT INTO feeders \(feeder_code, name, substation_id, status, created_by\) VALUES \(\?, \?, \?, 'ACTIVE', 'IMPORT_AUTO'\)`,\n\s*\[feederCode, feederCode, substationId \|\| 1\]\n\s*\);\n\s*const newFeeder = dbQueryOne\(\n\s*`SELECT id, substation_id FROM feeders WHERE feeder_code = \? LIMIT 1`,\n\s*\[feederCode\]\n\s*\);/g,
  `let newFeeder: any = null;\n        if (CORE_DATA_SOURCE === 'firestore') {\n          newFeeder = await feederRepo.create({ feeder_code: feederCode, name: feederCode, substation_id: String(substationId), status: 'ACTIVE' }, 'AUTO_IMPORT');\n        } else {\n          dbRun(\n            \`INSERT INTO feeders (feeder_code, name, substation_id, status, created_by) VALUES (?, ?, ?, 'ACTIVE', 'IMPORT_AUTO')\`,\n            [feederCode, feederCode, substationId || 1]\n          );\n          newFeeder = dbQueryOne(\n            \`SELECT id, substation_id FROM feeders WHERE feeder_code = ? LIMIT 1\`,\n            [feederCode]\n          );\n        }`
);

// Fix type of substationId / feederId
content = content.replace(
  /let substationId: number \| null = null;/g,
  `let substationId: any = null;`
);
content = content.replace(
  /let feederId: number \| null = null;/g,
  `let feederId: any = null;`
);


fs.writeFileSync('server/routes/import.ts', content);
console.log("Done");
