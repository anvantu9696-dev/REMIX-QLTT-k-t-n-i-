
import { getTargetFirestore } from './server/firebaseAdmin';

function normalizeId(value: any): string {
  return String(value ?? '').trim();
}

async function runDiagnostic() {
  const db = getTargetFirestore();
  
  const deviceSnap = await db.collection('devices').where('isDeleted', '==', false).get();
  const devices = deviceSnap.docs.map(d => ({id: d.id, ...d.data()})) as any[];
  
  const feederSnap = await db.collection('feeders').where('isDeleted', '==', false).get();
  const feeders = feederSnap.docs.map(d => ({id: d.id, ...d.data()})) as any[];
  
  const subSnap = await db.collection('substations').where('isDeleted', '==', false).get();
  const substations = subSnap.docs.map(d => ({id: d.id, ...d.data()})) as any[];

  const ORPHAN_FEEDER_IDS = new Set<string>();
  const ORPHAN_SUBSTATION_IDS = new Set<string>();
  const MISMATCH_IDS = new Set<string>();
  const VALID_IDS = new Set<string>();

  for (const device of devices) {
    const feeder = feeders.find(f => normalizeId(f.id) === normalizeId(device.feeder_id));
    const substation = substations.find(s => normalizeId(s.id) === normalizeId(device.substation_id));

    let isOrphanFeeder = !feeder && !!device.feeder_id;
    let isOrphanSubstation = !substation && !!device.substation_id;
    let isMismatch = !isOrphanFeeder && !isOrphanSubstation && feeder && substation && normalizeId(feeder.substation_id) !== normalizeId(device.substation_id);

    if (isOrphanFeeder) ORPHAN_FEEDER_IDS.add(device.id);
    if (isOrphanSubstation) ORPHAN_SUBSTATION_IDS.add(device.id);
    if (isMismatch) MISMATCH_IDS.add(device.id);
    if (!isOrphanFeeder && !isOrphanSubstation && !isMismatch) VALID_IDS.add(device.id);
  }

  const UNION_ABNORMAL_IDS = new Set([...ORPHAN_FEEDER_IDS, ...ORPHAN_SUBSTATION_IDS, ...MISMATCH_IDS]);

  console.log('--- DIAGNOSTIC REPORT ---');
  console.log(`Total devices: ${devices.length}`);
  console.log(`Unique device IDs: ${new Set(devices.map(d => d.id)).size}`);
  console.log(`Valid: ${VALID_IDS.size}`);
  console.log(`Orphan feeder: ${ORPHAN_FEEDER_IDS.size}`);
  console.log(`Orphan substation: ${ORPHAN_SUBSTATION_IDS.size}`);
  console.log(`Mismatch: ${MISMATCH_IDS.size}`);
  console.log(`Union abnormal: ${UNION_ABNORMAL_IDS.size}`);
  console.log(`Consistency: ${VALID_IDS.size + UNION_ABNORMAL_IDS.size === new Set(devices.map(d => d.id)).size}`);
  
  const intersect1 = new Set([...ORPHAN_FEEDER_IDS].filter(x => ORPHAN_SUBSTATION_IDS.has(x)));
  const intersect2 = new Set([...ORPHAN_FEEDER_IDS].filter(x => MISMATCH_IDS.has(x)));
  const intersect3 = new Set([...ORPHAN_SUBSTATION_IDS].filter(x => MISMATCH_IDS.has(x)));
  
  console.log(`Overlap O-F + O-S: ${intersect1.size}`);
  console.log(`Overlap O-F + Mismatch: ${intersect2.size}`);
  console.log(`Overlap O-S + Mismatch: ${intersect3.size}`);
}

runDiagnostic().catch(console.error);
