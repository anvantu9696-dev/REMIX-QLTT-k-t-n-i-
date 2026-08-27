import { getTargetFirestore } from '../firebaseAdmin';

async function check() {
    const db = getTargetFirestore();
    const snap = await db.collection('substations').where('isDeleted', '==', false).get();
    console.log("Count:", snap.size);
}
check().catch(console.error);
