
import { getTargetFirestore, FIRESTORE_TARGET } from './server/firebaseAdmin';

async function healthCheck() {
  const db = getTargetFirestore();
  const devicesSnap = await db.collection('devices').get();
  const feedersSnap = await db.collection('feeders').get();
  const subSnap = await db.collection('substations').get();
  const loopsSnap = await db.collection('loops').get();

  const devices = devicesSnap.docs.map(d => d.data());
  
  console.log(JSON.stringify({
    rawDevices: devices.length,
    activeDevices: devices.filter(d => d.isDeleted !== true).length,
    deletedDevices: devices.filter(d => d.isDeleted === true).length,
    feeders: feedersSnap.size,
    substations: subSnap.size,
    loops: loopsSnap.size,
    projectId: FIRESTORE_TARGET.projectId,
    databaseId: FIRESTORE_TARGET.databaseId
  }));
}

healthCheck().catch(console.error);
