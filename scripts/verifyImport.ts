import { getTargetFirestore } from '../server/firebaseAdmin';

async function check() {
    const db = getTargetFirestore();
    const snap = await db.collection('devices').get();
    const doc = snap.docs.find(d => d.id === 'XRKbKaRpbLxTTCPsW9pb');
    console.log('Found:', !!doc);
    if (doc) {
        console.log('isDeleted:', doc.data().isDeleted);
    }
    console.log('Total:', snap.size);
}
check().catch(console.error);
