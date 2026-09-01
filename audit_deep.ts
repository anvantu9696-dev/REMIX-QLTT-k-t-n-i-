
import { getTargetFirestore } from './server/firebaseAdmin';

async function runDeepAudit() {
  const db = getTargetFirestore();
  
  // 1. Get raw docs
  const devicesSnap = await db.collection('devices').get();
  const feedersSnap = await db.collection('feeders').get();
  const subsSnap = await db.collection('substations').get();

  const devices = devicesSnap.docs.map(d => ({id: d.id, ...d.data()})) as any[];
  const feeders = feedersSnap.docs.map(d => ({id: d.id, ...d.data()})) as any[];
  const substations = subsSnap.docs.map(d => ({id: d.id, ...d.data()})) as any[];

  // Statistics
  const stats = {
    devices: { raw: devices.length, isDeletedTrue: 0, isDeletedFalse: 0, missing: 0 },
    idAudit: { total: devices.length, uniqueIds: new Set(devices.map(d => d.id)).size, dataIds: new Set(devices.map(d => d.id)).size },
  };

  for (const d of devices) {
    if (d.isDeleted === true) stats.devices.isDeletedTrue++;
    else if (d.isDeleted === false) stats.devices.isDeletedFalse++;
    else stats.devices.missing++;
  }

  // Verification
  console.log('--- RAW REPORT ---');
  console.log(JSON.stringify(stats, null, 2));
  console.log('--- SAMPLE 5 ---');
  console.log(JSON.stringify(devices.slice(0, 5), null, 2));
}

runDeepAudit().catch(console.error);
