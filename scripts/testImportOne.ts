import { deviceRepo } from '../server/repositories/firestore/deviceRepository';

async function importOne() {
    try {
        const opId = 'TEST_IMPORT_001_' + Date.now();
        const created = await deviceRepo.create({
            substation_id: 1,
            feeder_id: 1,
            device_id: 'TEST_BULK_001',
            device_code: 'TEST_BULK_001',
            name: 'Test Device Bulk 001',
            status: 'ACTIVE',
            device_type: 'REC',
            createdBy: 'test_user',
            updatedBy: 'test_user'
        }, opId);
        console.log("Imported ID:", created.id);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
importOne();
