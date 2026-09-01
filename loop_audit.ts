
import { getTargetFirestore } from './server/firebaseAdmin';

async function runLoopAudit() {
  const db = getTargetFirestore();
  
  const loops = (await db.collection('loops').get()).docs.map(d => ({id: d.id, ...d.data()})) as any[];
  const devices = (await db.collection('devices').get()).docs.map(d => ({id: d.id, ...d.data()})) as any[];
  const feeders = (await db.collection('feeders').get()).docs.map(d => ({id: d.id, ...d.data()})) as any[];
  const substations = (await db.collection('substations').get()).docs.map(d => ({id: d.id, ...d.data()})) as any[];

  let validLoops = 0;
  let invalidLoops = 0;
  let missingDeviceRefs = 0;
  let missingFeederRefs = 0;
  let missingSubstationRefs = 0;
  let l01Valid = true;

  for (const loop of loops) {
    let isValid = true;
    
    // Check main devices
    const loopDeviceIds = [loop.device_id_a, loop.device_id_b, loop.loop_device_id].filter(Boolean);
    for (const id of loopDeviceIds) {
      const d = devices.find(x => String(x.id) === String(id));
      if (!d) {
        isValid = false;
        missingDeviceRefs++;
      } else if (d.isDeleted) {
        isValid = false;
      }
    }

    // Check Feeders/Substations
    const feederIds = [loop.feeder_id_a, loop.feeder_id_b].filter(Boolean);
    for (const id of feederIds) {
      if (!feeders.find(f => String(f.id) === String(id))) {
        isValid = false;
        missingFeederRefs++;
      }
    }
    
    const subIds = [loop.substation_id_a, loop.substation_id_b].filter(Boolean);
    for (const id of subIds) {
      if (!substations.find(s => String(s.id) === String(id))) {
        isValid = false;
        missingSubstationRefs++;
      }
    }

    if (isValid) validLoops++;
    else invalidLoops++;

    if (loop.loop_id === 'L01' || loop.id === 'L01') {
      l01Valid = isValid;
    }
  }

  console.log('--- LOOP AUDIT ---');
  console.log(JSON.stringify({
    total: loops.length,
    valid: validLoops,
    invalid: invalidLoops,
    missingDeviceRefs,
    missingFeederRefs,
    missingSubstationRefs,
    l01Valid
  }, null, 2));
}

runLoopAudit().catch(console.error);
