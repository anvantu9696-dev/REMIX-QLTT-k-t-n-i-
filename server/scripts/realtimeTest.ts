import { getTargetFirestore } from '../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

async function test() {
    const db = getTargetFirestore();
    const docRef = db.collection('devices').doc('CUTOVER_REALTIME_TEST_' + Date.now());
    await docRef.set({ name: 'Initial', updatedAt: FieldValue.serverTimestamp() });
    
    console.log("Fixture created");
    
    // We cannot open two clients, so we cannot verify realtime.
    // Realtime check is blocked/unverified.
    console.log("Realtime check: NOT_VERIFIED");
    
    await docRef.delete();
    console.log("Fixture cleaned");
}
test().catch(console.error);
