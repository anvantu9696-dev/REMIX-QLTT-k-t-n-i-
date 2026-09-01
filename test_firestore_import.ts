import { config } from 'dotenv';
config();
import { substationRepo } from './server/repositories/firestore/substationRepository';
import { getTargetFirestore } from './server/firebaseAdmin';

async function test() {
    try {
        const db = getTargetFirestore();
        console.log("Got Firestore", !!db);
        const newSub = await substationRepo.create({ substation_code: 'TEST_SUB_123', name: 'TEST_SUB_123', status: 'ACTIVE' }, 'AUTO_IMPORT');
        console.log("Created sub:", newSub);
    } catch (e) {
        console.error("Test error:", e);
    }
}
test();
