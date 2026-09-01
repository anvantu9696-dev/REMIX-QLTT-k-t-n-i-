import { getTargetFirestore } from './server/firebaseAdmin.js';

async function checkTypes() {
  const db = getTargetFirestore();
  const devicesSnap = await db.collection('devices').limit(5).get();
  for (const d of devicesSnap.docs) {
    console.log('ID:', d.id, 'feeder_id:', d.data().feeder_id, 'Type:', typeof d.data().feeder_id);
  }
}
checkTypes().catch(console.error);
