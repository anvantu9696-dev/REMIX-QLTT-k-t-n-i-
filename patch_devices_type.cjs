const fs = require('fs');
let code = fs.readFileSync('server/repositories/firestore/deviceRepository.ts', 'utf8');

code = code.replace(
  "  substation_name?: string;\n  feeder_name?: string;",
  "  substation_name?: string;\n  feeder_name?: string;\n  substation_code?: string;\n  feeder_code?: string;"
);

// We need to also populate them in create/update
code = code.replace(/const subDoc = await transaction.get\(db.collection\('substations'\).doc\(String\(data.substation_id\)\)\);\n            if \(subDoc.exists\) substation_name = subDoc.data\(\)\?.name;/g,
  `const subDoc = await transaction.get(db.collection('substations').doc(String(data.substation_id)));
            if (subDoc.exists) {
                substation_name = subDoc.data()?.name;
                data.substation_code = subDoc.data()?.substation_code;
            }`);
            
code = code.replace(/const fdDoc = await transaction.get\(db.collection\('feeders'\).doc\(String\(data.feeder_id\)\)\);\n            if \(fdDoc.exists\) feeder_name = fdDoc.data\(\)\?.name;/g,
  `const fdDoc = await transaction.get(db.collection('feeders').doc(String(data.feeder_id)));
            if (fdDoc.exists) {
                feeder_name = fdDoc.data()?.name;
                data.feeder_code = fdDoc.data()?.feeder_code;
            }`);

code = code.replace(/const docData = {\n            \.\.\.data,\n            substation_name,\n            feeder_name,/g,
  `const docData = {
            ...data,
            substation_name,
            substation_code: data.substation_code,
            feeder_name,
            feeder_code: data.feeder_code,`);
            
code = code.replace(/const updateData = {\n            \.\.\.currentData,\n            \.\.\.data,\n            substation_name,\n            feeder_name,/g,
  `const updateData = {
            ...currentData,
            ...data,
            substation_name,
            substation_code: data.substation_code !== undefined ? data.substation_code : currentData.substation_code,
            feeder_name,
            feeder_code: data.feeder_code !== undefined ? data.feeder_code : currentData.feeder_code,`);

fs.writeFileSync('server/repositories/firestore/deviceRepository.ts', code);
console.log('Patched deviceRepository code');
