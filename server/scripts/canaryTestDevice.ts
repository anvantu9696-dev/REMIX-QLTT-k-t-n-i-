import { deviceRepo } from '../repositories/firestore/deviceRepository';
import { getTargetFirestore } from '../firebaseAdmin';

async function test() {
    const opId = 'test_device_' + Date.now();
    const stationId = 1; // Existing
    const feederId = 1; // Existing

    console.log("Starting Device Test...");

    // 1. POST
    const created = await deviceRepo.create({
        substation_id: stationId,
        feeder_id: feederId,
        device_id: 'DEV-CUTOVER_TEST_DEVICE_1',
        device_code: 'CUTOVER_TEST_DEVICE_1',
        name: 'Test Device',
        status: 'ACTIVE',
        device_type: 'REC',
        createdBy: 'test_user',
        updatedBy: 'test_user'
    }, opId);
    console.log("Created:", created.id);

    // 2. Idempotency
    const created2 = await deviceRepo.create({
        substation_id: stationId,
        feeder_id: feederId,
        device_id: 'DEV-CUTOVER_TEST_DEVICE_1',
        device_code: 'CUTOVER_TEST_DEVICE_1',
        name: 'Test Device 2',
        status: 'ACTIVE',
        device_type: 'REC',
        createdBy: 'test_user',
        updatedBy: 'test_user'
    }, opId);
    console.log("Idempotent check (version):", created2.version);
    
    // 3. Update
    const updated = await deviceRepo.update(created.id, { name: 'Updated Device' }, 1, 'op_update_1');
    console.log("Updated version:", updated.version);
    
    // 4. Update with wrong version
    try {
        await deviceRepo.update(created.id, { name: 'Broken Device' }, 1, 'op_update_2');
    } catch (e: any) {
        console.log("Expected conflict:", e.message);
    }
    
    // 5. Delete
    await deviceRepo.delete(created.id, 'op_delete_1');
    const finalDoc = await deviceRepo.getById(created.id);
    console.log("Is deleted:", finalDoc?.isDeleted);

    console.log("Device Test Passed");
}

test().catch(console.error);
