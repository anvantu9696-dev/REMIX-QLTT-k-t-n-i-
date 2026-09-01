import { deviceRepo } from './server/repositories/firestore/deviceRepository';
import { getTargetFirestore } from './server/firebaseAdmin';

async function testHardDelete() {
    const db = getTargetFirestore();
    const opId = 'TEST_HARD_DELETE_' + Date.now();
    
    // 1. Create
    const created = await deviceRepo.create({
        substation_id: 1, // Assuming exists, or use a known one
        feeder_id: 1,
        device_id: 'DEV-HARD_DELETE_TEST',
        device_code: 'HARD_DELETE_TEST',
        name: 'Hard Delete Test Device',
        status: 'ACTIVE',
        device_type: 'REC',
        createdBy: 'test_user',
        updatedBy: 'test_user'
    }, opId);
    console.log("Created ID:", created.id);
    
    // 2. Verify
    const docRef = db.collection('devices').doc(created.id);
    const doc = await docRef.get();
    console.log("Exists:", doc.exists);
    if (!doc.exists) throw new Error("Creation failed");

    // 3. Delete
    await deviceRepo.delete(created.id, opId + '_del', 'test_user');
    
    // 4. Verify hard delete
    const docAfterDelete = await docRef.get();
    console.log("Exists after delete:", docAfterDelete.exists);

    // 5. Check backup
    const backupSnapshot = await db.collection('deleted_devices_backup')
        .where('originalId', '==', created.id)
        .get();
    console.log("Backup exists:", !backupSnapshot.empty);
    
    // 6. Test re-import
    const reCreated = await deviceRepo.create({
        substation_id: 1,
        feeder_id: 1,
        device_id: 'DEV-HARD_DELETE_TEST',
        device_code: 'HARD_DELETE_TEST',
        name: 'Hard Delete Test Device Re-imported',
        status: 'ACTIVE',
        device_type: 'REC',
        createdBy: 'test_user',
        updatedBy: 'test_user'
    }, opId + '_re');
    console.log("Re-created ID:", reCreated.id);
    
    console.log("Hard delete test passed");
}

testHardDelete().catch(e => { console.error(e); process.exit(1); });
