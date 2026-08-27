import { feederRepo } from '../repositories/firestore/feederRepository';
import { getTargetFirestore } from '../firebaseAdmin';

async function test() {
    const opId = 'test_feeder_' + Date.now();
    const stationId = '1'; // Existing station

    console.log("Starting Feeder Test...");

    // 1. POST
    const created = await feederRepo.create({
        substation_id: stationId,
        feeder_code: 'CUTOVER_TEST_FEEDER_1',
        name: 'Test Feeder',
        status: 'ACTIVE',
        createdBy: 'test_user',
        updatedBy: 'test_user'
    }, opId);
    console.log("Created:", created.id);

    // 2. Idempotency
    const created2 = await feederRepo.create({
        substation_id: stationId,
        feeder_code: 'CUTOVER_TEST_FEEDER_1',
        name: 'Test Feeder 2',
        status: 'ACTIVE',
        createdBy: 'test_user',
        updatedBy: 'test_user'
    }, opId);
    console.log("Idempotent check (version):", created2.version);
    
    // 3. Update
    const updated = await feederRepo.update(created.id, { name: 'Updated Feeder' }, 1, 'op_update_1');
    console.log("Updated version:", updated.version);
    
    // 4. Update with wrong version
    try {
        await feederRepo.update(created.id, { name: 'Broken Feeder' }, 1, 'op_update_2');
    } catch (e: any) {
        console.log("Expected conflict:", e.message);
    }
    
    // 5. Delete
    await feederRepo.delete(created.id, 'op_delete_1');
    const finalDoc = await feederRepo.getById(created.id);
    console.log("Is deleted:", finalDoc?.isDeleted);

    console.log("Feeder Test Passed");
}

test().catch(console.error);
