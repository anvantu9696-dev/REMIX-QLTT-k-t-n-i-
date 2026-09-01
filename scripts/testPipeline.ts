import { deviceRepo } from '../server/repositories/firestore/deviceRepository';
import { resolveDeviceRelations } from '../server/utils/relationValidator';

async function testPipeline() {
    const testRows = [
        { device_id: 'TEST1', name: 'Test 1', device_type: 'LBS', substation_id: 1, feeder_id: 1, created_by: 'test' },
        { device_id: 'TEST2', name: 'Test 2', device_type: 'LBS', substation_id: 1, feeder_id: 1, created_by: 'test' },
        { device_id: 'TEST3', name: 'Test 3', device_type: 'LBS', substation_id: 1, feeder_id: 1, created_by: 'test' },
        { device_id: 'TEST4', name: 'Test 4', device_type: 'LBS', substation_id: 1, feeder_id: 1, created_by: 'test' },
        { device_id: 'TEST5', name: 'Test 5', device_type: 'LBS', substation_id: 1, feeder_id: 1, created_by: 'test' },
    ];

    let success = 0;
    let failed = 0;

    for (const row of testRows) {
        try {
            console.log(`Writing ${row.device_id}...`);
            await deviceRepo.create(row as any, `TEST_OP_${Date.now()}_${row.device_id}`);
            success++;
            console.log(`Successfully wrote ${row.device_id}`);
        } catch (e) {
            console.error(`Failed to write ${row.device_id}:`, e);
            failed++;
        }
    }

    console.log(`Total attempted: ${testRows.length}, Success: ${success}, Failed: ${failed}`);
}

testPipeline().catch(console.error);
