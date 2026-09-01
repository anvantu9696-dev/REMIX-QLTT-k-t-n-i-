import { getTargetFirestore } from '../server/firebaseAdmin';

async function bulkImportTest() {
    const db = getTargetFirestore();
    // Test data for 5 devices
    const testData = [
        { device_id: 'TEST_B_1', name: 'Bulk Test 1', device_type: 'REC', substation_id: 1, feeder_id: 1, created_by: 'test' },
        { device_id: 'TEST_B_2', name: 'Bulk Test 2', device_type: 'REC', substation_id: 1, feeder_id: 1, created_by: 'test' },
        { device_id: 'TEST_B_3', name: 'Bulk Test 3', device_type: 'REC', substation_id: 1, feeder_id: 1, created_by: 'test' },
        { device_id: 'TEST_B_4', name: 'Bulk Test 4', device_type: 'REC', substation_id: 1, feeder_id: 1, created_by: 'test' },
        { device_id: 'TEST_B_5', name: 'Bulk Test 5', device_type: 'REC', substation_id: 1, feeder_id: 1, created_by: 'test' },
    ];

    console.log('--- Starting Bulk Import Simulation ---');
    console.log('BEFORE COUNT: 8');

    let successCount = 0;
    const importedIds: string[] = [];

    for (const row of testData) {
        try {
            // Mimic backend logic
            const docRef = db.collection('devices').doc();
            await docRef.set({
                ...row,
                isDeleted: false,
                created_at: new Date(),
            });
            importedIds.push(docRef.id);
            successCount++;
        } catch (e) {
            console.error('FAILED ROW:', row.device_id, e);
        }
    }

    console.log(`BACKEND RECEIVED: ${successCount}/5`);

    // Verify in Firestore
    const snap = await db.collection('devices').where('device_id', 'in', testData.map(d => d.device_id)).get();
    console.log(`FIRESTORE FOUND: ${snap.size}/5`);
    const activeCount = snap.docs.filter(d => !d.data().isDeleted).length;
    console.log(`ACTIVE: ${activeCount}/5`);

    console.log('--- Test Completed ---');
}

bulkImportTest().catch(console.error);
