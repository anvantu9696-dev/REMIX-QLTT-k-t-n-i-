
import { getTargetFirestore } from './server/firebaseAdmin';

function normalizeId(value: any): string {
  return String(value ?? '').trim();
}

async function auditDeviceFeeder() {
  const db = getTargetFirestore();
  const devicesSnap = await db.collection('devices').get();
  const feedersSnap = await db.collection('feeders').get();

  const devices = devicesSnap.docs.map(d => ({ firestoreDocId: d.id, ...d.data() })) as any[];
  const feeders = feedersSnap.docs.map(f => ({ firestoreDocId: f.id, ...f.data() })) as any[];

  const activeDevices = devices.filter(d => d.isDeleted !== true);

  const stats = {
    MATCH_BY_DOC_ID: 0,
    MATCH_BY_DATA_ID: 0,
    MATCH_BY_FEEDER_ID: 0,
    MATCH_BY_FEEDERID: 0,
    MATCH_BY_CODE: 0,
    MATCH_BY_FEEDER_CODE: 0,
    NO_MATCH: 0,
    DELETED_FEEDER_REFERENCE: 0
  };

  for (const d of activeDevices) {
    const fid = normalizeId(d.feeder_id);
    let matched = false;

    // A. Doc ID
    if (feeders.some(f => normalizeId(f.firestoreDocId) === fid)) {
      stats.MATCH_BY_DOC_ID++;
      matched = true;
    } else if (feeders.some(f => normalizeId(f.id) === fid)) {
      stats.MATCH_BY_DATA_ID++;
      matched = true;
    } else if (feeders.some(f => normalizeId(f.feeder_id) === fid)) {
      stats.MATCH_BY_FEEDER_ID++;
      matched = true;
    } else if (feeders.some(f => normalizeId(f.feederId) === fid)) {
      stats.MATCH_BY_FEEDERID++;
      matched = true;
    } else if (feeders.some(f => normalizeId(f.code) === fid)) {
      stats.MATCH_BY_CODE++;
      matched = true;
    } else if (feeders.some(f => normalizeId(f.feeder_code) === fid)) {
      stats.MATCH_BY_FEEDER_CODE++;
      matched = true;
    }

    if (matched) {
       const f = feeders.find(x => 
         normalizeId(x.firestoreDocId) === fid || 
         normalizeId(x.id) === fid ||
         normalizeId(x.feeder_id) === fid ||
         normalizeId(x.feederId) === fid ||
         normalizeId(x.code) === fid ||
         normalizeId(x.feeder_code) === fid
       );
       if (f && f.isDeleted === true) {
         stats.DELETED_FEEDER_REFERENCE++;
       }
    } else {
      stats.NO_MATCH++;
    }
  }

  console.log(JSON.stringify(stats, null, 2));
}

auditDeviceFeeder().catch(console.error);
