import { getTargetFirestore } from '../firebaseAdmin';

async function check() {
    const db = getTargetFirestore();
    const snap = await db.collection('substations').get();
    console.log("Total Count:", snap.size);
    snap.docs.forEach(d => console.log(d.id, d.data().substation_code));
}
check().catch(console.error);
