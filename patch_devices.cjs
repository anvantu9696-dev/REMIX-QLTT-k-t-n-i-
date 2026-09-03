const fs = require('fs');
let code = fs.readFileSync('server/repositories/firestore/deviceRepository.ts', 'utf8');

code = code.replace(
  "  substation_id: string | number;\n  feeder_id: string | number;",
  "  substation_id: string | number;\n  feeder_id: string | number;\n  substation_name?: string;\n  feeder_name?: string;"
);

const createOld = `        const docData = {
            ...data,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            lastOperationId: operationId,
            status: data.status || 'ACTIVE',
            device_type: data.device_type || 'OTHER'
        };`;

const createNew = `        let substation_name = data.substation_name;
        if (data.substation_id && !substation_name) {
            const subDoc = await transaction.get(db.collection('substations').doc(String(data.substation_id)));
            if (subDoc.exists) substation_name = subDoc.data()?.name;
        }
        let feeder_name = data.feeder_name;
        if (data.feeder_id && !feeder_name) {
            const fdDoc = await transaction.get(db.collection('feeders').doc(String(data.feeder_id)));
            if (fdDoc.exists) feeder_name = fdDoc.data()?.name;
        }

        const docData = {
            ...data,
            substation_name,
            feeder_name,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            lastOperationId: operationId,
            status: data.status || 'ACTIVE',
            device_type: data.device_type || 'OTHER'
        };`;

code = code.replace(createOld, createNew);

const updateOld = `        const updateData = {
            ...currentData,
            ...data,
            version: currentData.version + 1,
            updatedAt: now,
            lastOperationId: operationId
        };`;

const updateNew = `        let substation_name = data.substation_name !== undefined ? data.substation_name : currentData.substation_name;
        if (data.substation_id !== undefined && String(data.substation_id) !== String(currentData.substation_id)) {
            const subDoc = await transaction.get(db.collection('substations').doc(String(data.substation_id)));
            if (subDoc.exists) substation_name = subDoc.data()?.name;
            else substation_name = undefined;
        }
        
        let feeder_name = data.feeder_name !== undefined ? data.feeder_name : currentData.feeder_name;
        if (data.feeder_id !== undefined && String(data.feeder_id) !== String(currentData.feeder_id)) {
            const fdDoc = await transaction.get(db.collection('feeders').doc(String(data.feeder_id)));
            if (fdDoc.exists) feeder_name = fdDoc.data()?.name;
            else feeder_name = undefined;
        }

        const updateData = {
            ...currentData,
            ...data,
            substation_name,
            feeder_name,
            version: currentData.version + 1,
            updatedAt: now,
            lastOperationId: operationId
        };`;

code = code.replace(updateOld, updateNew);

fs.writeFileSync('server/repositories/firestore/deviceRepository.ts', code);
console.log('Patched deviceRepository');
