import { getTargetFirestore } from './server/firebaseAdmin';
import * as fs from 'fs';
import * as path from 'path';

async function forensicAudit() {
  const db = getTargetFirestore();
  const devicesSnap = await db.collection('devices').get();
  const feedersSnap = await db.collection('feeders').get();

  const devices = devicesSnap.docs.map(d => ({ firestoreDocId: d.id, ...d.data() })) as any[];
  const feeders = feedersSnap.docs.map(f => ({ firestoreDocId: f.id, ...f.data() })) as any[];

  const activeDevices = devices.filter(d => d.isDeleted !== true);
  const activeFeeders = feeders.filter(f => f.isDeleted !== true);

  // 1. UNIQUE DEVICE FEEDER IDS
  const feederIdCounts = new Map<string, number>();
  for (const d of activeDevices) {
    const fid = String(d.feeder_id ?? '').trim();
    if (fid) {
      feederIdCounts.set(fid, (feederIdCounts.get(fid) || 0) + 1);
    }
  }

  // 2. FORMAT ANALYSIS
  const feederIds = Array.from(feederIdCounts.keys());
  const formatStats = {
    numeric: 0, alphanumeric: 0, uuid: 0, hyphen: 0, empty: 0, other: 0
  };
  feederIds.forEach(id => {
    if (/^\d+$/.test(id)) formatStats.numeric++;
    else if (/^[a-z0-9-]+$/i.test(id)) {
      if (id.includes('-')) formatStats.hyphen++;
      else if (id.length === 36) formatStats.uuid++;
      else formatStats.alphanumeric++;
    }
    else formatStats.other++;
  });

  // 3. LEGACY FIELDS IN FEEDER
  const allFeederFields = new Set<string>();
  feeders.forEach(f => Object.keys(f).forEach(k => allFeederFields.add(k)));
  
  // Try exact match with any scalar
  let matchByAnyScalar = 0;
  for (const [fid, count] of feederIdCounts) {
    for (const f of feeders) {
      let matched = false;
      for (const field of allFeederFields) {
        if (field === 'firestoreDocId') continue; // Handled separately
        if (String(f[field] ?? '').trim() === fid) {
          matched = true;
          break;
        }
      }
      if (matched) {
        matchByAnyScalar += count;
        break;
      }
    }
  }

  console.log(JSON.stringify({
    uniqueIds: feederIdCounts.size,
    totalDevices: activeDevices.length,
    formatStats,
    sampleIds: feederIds.slice(0, 30),
    allFeederFields: Array.from(allFeederFields),
    matchByAnyScalar
  }, null, 2));
}

forensicAudit().catch(console.error);
