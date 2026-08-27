import { getTargetFirestore } from '../firebaseAdmin';

async function test() {
    const db = getTargetFirestore();
    const snapshot = await db.collection('device_images').get();
    console.log("Total images:", snapshot.size);
    if (snapshot.size > 0) {
        const doc = snapshot.docs[0].data();
        console.log("Sample image structure:", JSON.stringify(doc));
    }
}
test().catch(console.error);
