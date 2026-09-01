import { getTargetFirestore } from '../firebaseAdmin';

export async function generateNextDeviceCode(deviceType: string, feederId?: string | number | null, substationId?: string | number | null): Promise<string> {
  const upperType = (deviceType || 'LBS').toUpperCase();
  let prefix = `${upperType}-SYS`;

  const scopeFeederId = feederId ? String(feederId) : null;
  const scopeSubstationId = substationId ? String(substationId) : null;

  const db = getTargetFirestore();

  if (scopeFeederId) {
    try {
        const feederDoc = await db.collection('feeders').doc(scopeFeederId).get();
        if (feederDoc.exists) {
            const feeder = feederDoc.data()!;
            const codeOrName = (feeder.feeder_code || feeder.name || '').trim().toUpperCase();
            const cleanCode = codeOrName.startsWith('F') ? codeOrName : `F${codeOrName}`;
            prefix = `${upperType}-${cleanCode}`;
        }
    } catch(e){}
  } else if (scopeSubstationId) {
    try {
        const subDoc = await db.collection('substations').doc(scopeSubstationId).get();
        if (subDoc.exists) {
            const sub = subDoc.data()!;
            const subCode = (sub.substation_code || sub.name || '').replace(/\s+/g, '_').toUpperCase();
            prefix = `${upperType}-TRAM-${subCode}`;
        }
    } catch(e){}
  }

  try {
      let q: any = db.collection('devices').where('device_type', '==', upperType);
      
      // Filter logic
      // Note: for Firestore, we might have to just fetch all and filter if indexes are missing
      const snap = await db.collection('devices').get();
      let existingDevices = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      existingDevices = existingDevices.filter(d => !d.deleted_at && !d.isDeleted && d.device_type === upperType);
      
      if (scopeFeederId) {
        existingDevices = existingDevices.filter(d => String(d.feeder_id) === scopeFeederId);
      } else if (scopeSubstationId) {
        existingDevices = existingDevices.filter(d => String(d.substation_id) === scopeSubstationId && !d.feeder_id);
      } else {
        existingDevices = existingDevices.filter(d => !d.feeder_id && !d.substation_id);
      }

      const usedNumbers = new Set<number>();
      const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');

      for (const d of existingDevices) {
        if (d.name) {
          const match = d.name.trim().match(regex);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num)) {
              usedNumbers.add(num);
            }
          }
        }
      }

      let nextNum = 1;
      while (usedNumbers.has(nextNum)) {
        nextNum++;
      }

      const paddedNum = nextNum.toString().padStart(3, '0');
      return `${prefix}-${paddedNum}`;
  } catch (e) {
      return `${prefix}-001`;
  }
}
