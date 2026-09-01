import { getTargetFirestore } from './server/firebaseAdmin';

function normalizeId(value: any): string {
  return String(value ?? '').trim();
}

async function runReadOnlyAudit() {
  const db = getTargetFirestore();
  const devicesSnap = await db.collection('devices').get();
  const feedersSnap = await db.collection('feeders').get();

  const devices = devicesSnap.docs.map(d => ({ firestoreDocId: d.id, ...d.data() })) as any[];
  const feeders = feedersSnap.docs.map(f => ({ firestoreDocId: f.id, ...f.data() })) as any[];

  const activeDevices = devices.filter(d => d.isDeleted !== true);

  const matchStats = {
    BY_DOC_ID: 0,
    BY_DATA_ID: 0,
    BY_FEEDER_ID: 0,
    BY_FEEDERID: 0,
    BY_CODE: 0,
    BY_FEEDER_CODE: 0,
    NO_MATCH: 0
  };

  const relStats = {
    Valid: 0,
    OrphanFeeder: 0,
    DeletedFeederRef: 0,
    OrphanSubstation: 0,
    Mismatch: 0
  };

  for (const d of activeDevices) {
    const fid = normalizeId(d.feeder_id);
    if (!fid) {
      matchStats.NO_MATCH++;
      relStats.OrphanFeeder++;
      continue;
    }

    let matchedFeeder = null;
    let matchedBy = '';

    if ((matchedFeeder = feeders.find(f => normalizeId(f.firestoreDocId) === fid))) { matchedBy = 'DOC_ID'; matchStats.BY_DOC_ID++; }
    else if ((matchedFeeder = feeders.find(f => normalizeId(f.id) === fid))) { matchedBy = 'DATA_ID'; matchStats.BY_DATA_ID++; }
    else if ((matchedFeeder = feeders.find(f => normalizeId(f.feeder_id) === fid))) { matchedBy = 'FEEDER_ID'; matchStats.BY_FEEDER_ID++; }
    else if ((matchedFeeder = feeders.find(f => normalizeId(f.feederId) === fid))) { matchedBy = 'FEEDERID'; matchStats.BY_FEEDERID++; }
    else if ((matchedFeeder = feeders.find(f => normalizeId(f.code) === fid))) { matchedBy = 'CODE'; matchStats.BY_CODE++; }
    else if ((matchedFeeder = feeders.find(f => normalizeId(f.feeder_code) === fid))) { matchedBy = 'FEEDER_CODE'; matchStats.BY_FEEDER_CODE++; }
    else {
      matchStats.NO_MATCH++;
      relStats.OrphanFeeder++;
    }

    if (matchedFeeder) {
      if (matchedFeeder.isDeleted === true) {
        relStats.DeletedFeederRef++;
      } else {
        relStats.Valid++;
      }
    }
  }

  console.log('--- MATCH STATS ---');
  console.log(JSON.stringify(matchStats, null, 2));
  console.log('--- RELATION STATS ---');
  console.log(JSON.stringify(relStats, null, 2));
}

runReadOnlyAudit().catch(console.error);
