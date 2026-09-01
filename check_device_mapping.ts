import { getTargetFirestore } from './server/firebaseAdmin.js';

async function checkDevice() {
  const db = getTargetFirestore();
  const devicesSnap = await db.collection('devices').where('device_id', '==', 'REC-471GĐ-001').get();
  
  if (devicesSnap.empty) {
    console.log('Device not found');
    return;
  }
  
  for (const d of devicesSnap.docs) {
    console.log('ID:', d.id, 'Data:', JSON.stringify(d.data()));
  }
}
checkDevice().catch(console.error);
