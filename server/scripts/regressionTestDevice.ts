import { deviceRepo } from '../repositories/firestore/deviceRepository';
import { getTargetFirestore } from '../firebaseAdmin';

async function test() {
    const opId = 'CUTOVER_REGRESSION_' + Date.now();
    const stationId = 1; // Assuming existence
    const feederId = 1; 

    console.log("Starting Device Regression Test...");

    // 1. Create
    const created = await deviceRepo.create({
        substation_id: stationId,
        feeder_id: feederId,
        device_id: 'DEV-CUTOVER_REGRESSION_DEVICE',
        device_code: 'CUTOVER_REGRESSION_DEVICE',
        name: 'Regression Test Device',
        status: 'ACTIVE',
        device_type: 'REC',
        createdBy: 'test_user',
        updatedBy: 'test_user',
        latitude: 10.1,
        longitude: 106.1
    }, opId);
    console.log("Created ID:", created.id);

    // 2. Update
    const updated = await deviceRepo.update(created.id, { name: 'Updated Regression Device', status: 'INACTIVE' }, 1, 'op_reg_update_1');
    console.log("Updated Name:", updated.name);

    // 3. Delete
    await deviceRepo.delete(created.id, 'op_reg_delete_1', 'test_user');
    const finalDoc = await deviceRepo.getById(created.id);
    console.log("Deleted exists:", !!finalDoc);

    console.log("Device Regression Test Passed");
}

test().catch(e => { console.error(e); process.exit(1); });
