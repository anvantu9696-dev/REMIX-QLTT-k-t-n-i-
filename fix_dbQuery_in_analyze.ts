import fs from 'fs';

let content = fs.readFileSync('server/routes/import.ts', 'utf8');

content = content.replace(
  /const dbDevices = dbQuery\(\n\s*`SELECT d\.id, d\.device_id, d\.name, d\.device_type, d\.status, d\.google_maps_url,\n\s*f\.feeder_code, f\.name as feeder_name, s\.substation_code, s\.name as substation_name\n\s*FROM devices d\n\s*LEFT JOIN feeders f ON d\.feeder_id = f\.id\n\s*LEFT JOIN substations s ON d\.substation_id = s\.id\n\s*WHERE d\.deleted_at IS NULL`\n\s*\);/g,
  `let dbDevices: any[] = [];\n  if (CORE_DATA_SOURCE === 'firestore') {\n    dbDevices = await deviceRepo.list();\n  } else {\n    dbDevices = dbQuery(\n      \`SELECT d.id, d.device_id, d.name, d.device_type, d.status, d.google_maps_url,\n              f.feeder_code, f.name as feeder_name, s.substation_code, s.name as substation_name\n       FROM devices d\n       LEFT JOIN feeders f ON d.feeder_id = f.id\n       LEFT JOIN substations s ON d.substation_id = s.id\n       WHERE d.deleted_at IS NULL\`\n    );\n  }`
);

fs.writeFileSync('server/routes/import.ts', content);
