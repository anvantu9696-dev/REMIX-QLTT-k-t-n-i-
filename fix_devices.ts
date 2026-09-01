
import { getTargetFirestore } from './server/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

async function runFix() {
  const db = getTargetFirestore();
  
  const devices = (await db.collection('devices').where('isDeleted', '==', false).get()).docs.map(d => ({id: d.id, ...d.data()})) as any[];
  const feeders = (await db.collection('feeders').where('isDeleted', '==', false).get()).docs.map(d => ({id: d.id, ...d.data()})) as any[];
  
  const mismatchDevices = devices.filter(device => 
    device.feeder_id && 
    device.substation_id && 
    String(feeders.find(f => String(f.id) === String(device.feeder_id))?.substation_id) !== String(device.substation_id)
  );

  console.log(`Found ${mismatchDevices.length} mismatch devices.`);

  let updated = 0;
  let skippedConcurrent = 0;
  let skippedVersionConflict = 0;
  let failed = 0;

  for (const device of mismatchDevices) {
    const feeder = feeders.find(f => String(f.id) === String(device.feeder_id));
    if (!feeder) {
      failed++;
      continue;
    }

    const suggestedSubstationId = feeder.substation_id;

    // Pre-check
    const currentDeviceDoc = await db.collection('devices').doc(device.id).get();
    const currentDevice = currentDeviceDoc.data() as any;

    if (!currentDevice || currentDevice.isDeleted) {
      skippedConcurrent++;
      continue;
    }
    
    // Check version conflict
    const expectedVersion = device.version || 1;
    if (currentDevice.version !== expectedVersion) {
        skippedVersionConflict++;
        continue;
    }

    try {
      await db.runTransaction(async (transaction) => {
        const deviceRef = db.collection('devices').doc(device.id);
        transaction.update(deviceRef, {
          substation_id: suggestedSubstationId,
          version: (currentDevice.version || 1) + 1,
          updatedAt: new Date().toISOString()
        });

        // Audit Log
        const auditRef = db.collection('auditLogs').doc();
        transaction.set(auditRef, {
            entity_type: 'DEVICE',
            entity_id: device.id,
            action: 'RELATION_REPAIR',
            field: 'substation_id',
            old_value: device.substation_id,
            new_value: suggestedSubstationId,
            reason: 'FEEDER_SUBSTATION_MISMATCH',
            repair_mode: 'SAFE_AUTO_FIX',
            timestamp: new Date().toISOString(),
            actor: 'system_audit_fix'
        });
      });
      updated++;
    } catch (e) {
      console.error(e);
      failed++;
    }
  }

  console.log(`Updated: ${updated}`);
  console.log(`Skipped Concurrent: ${skippedConcurrent}`);
  console.log(`Skipped Version Conflict: ${skippedVersionConflict}`);
  console.log(`Failed: ${failed}`);
}

runFix().catch(console.error);
