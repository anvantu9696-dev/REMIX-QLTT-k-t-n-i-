import { getTargetFirestore } from './server/firebaseAdmin';

async function runAudit() {
  const db = getTargetFirestore();
  
  const devices = (await db.collection('devices').where('isDeleted', '==', false).get()).docs.map(d => ({id: d.id, ...d.data()})) as any[];
  const feeders = (await db.collection('feeders').where('isDeleted', '==', false).get()).docs.map(d => ({id: d.id, ...d.data()})) as any[];
  const substations = (await db.collection('substations').where('isDeleted', '==', false).get()).docs.map(d => ({id: d.id, ...d.data()})) as any[];

  const abnormalDevices = [];

  for (const device of devices) {
    const feeder = feeders.find(f => String(f.id) === String(device.feeder_id));
    const substation = substations.find(s => String(s.id) === String(device.substation_id));

    let status = 'VALID';
    let reason = '';

    if (!feeder) {
      status = 'ORPHAN_FEEDER';
      reason = 'Feeder not found';
    } else if (!substation) {
      status = 'ORPHAN_SUBSTATION';
      reason = 'Substation not found';
    } else if (String(feeder.substation_id) !== String(device.substation_id)) {
      status = 'FEEDER_SUBSTATION_MISMATCH';
      reason = `Feeder (${feeder.substation_id}) mismatch with Device (${device.substation_id})`;
    }

    if (status !== 'VALID') {
      abnormalDevices.push({
        ...device,
        relation_status: status,
        reason,
        current_substation_name: substation?.name || 'N/A',
        current_feeder_name: feeder?.name || 'N/A'
      });
    }
  }

  console.log('--- ABNORMAL DEVICES REPORT ---');
  console.log(JSON.stringify(abnormalDevices, null, 2));
}

runAudit().catch(console.error);
