import { getTargetFirestore } from '../firebaseAdmin';

async function deleteAllDevices() {
  const db = getTargetFirestore();
  const snapshot = await db.collection('devices').get();
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`Deleted ${snapshot.size} devices.`);
}

deleteAllDevices().catch(console.error);
