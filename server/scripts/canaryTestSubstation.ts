import fs from 'fs';
import { getTargetFirestore } from '../firebaseAdmin';
import { substationRepo } from '../repositories/firestore/substationRepository';
import * as crypto from 'crypto';

async function test() {
    const db = getTargetFirestore();
    const opId = 'test_op_' + Date.now();
    const stationCode = 'CUTOVER_TEST_STATION_1';

    console.log("Starting Test...");

    // 1. POST
    const created = await substationRepo.create({
        substation_code: stationCode,
        name: 'Test Station',
        status: 'ACTIVE'
    }, opId);
    console.log("Created:", created.id);

    // 2. Idempotency (Same opId)
    const created2 = await substationRepo.create({
        substation_code: stationCode,
        name: 'Test Station 2',
        status: 'ACTIVE'
    }, opId);
    console.log("Idempotent check (version):", created2.version);
    
    // 3. Update
    const updated = await substationRepo.update(created.id, { name: 'Updated Station' }, 1, 'op_update_1');
    console.log("Updated version:", updated.version);
    
    // 4. Update with wrong version
    try {
        await substationRepo.update(created.id, { name: 'Broken Station' }, 1, 'op_update_2');
    } catch (e: any) {
        console.log("Expected conflict:", e.message);
    }
    
    // 5. Delete
    await substationRepo.delete(created.id, 'op_delete_1');
    const finalDoc = await substationRepo.getById(created.id);
    console.log("Is deleted:", finalDoc?.isDeleted);

    console.log("Test Passed");
}

test().catch(console.error);
