
import { getTargetFirestore } from './server/firebaseAdmin';

async function findSafeAutoFix() {
  const db = getTargetFirestore();
  
  const devices = (await db.collection('devices').where('isDeleted', '==', false).get()).docs.map(d => ({id: d.id, ...d.data()})) as any[];
  const feeders = (await db.collection('feeders').where('isDeleted', '==', false).get()).docs.map(d => ({id: d.id, ...d.data()})) as any[];
  
  const mismatchDevices = devices.filter(device => 
    device.feeder_id && 
    device.substation_id && 
    feeders.find(f => String(f.id) === String(device.feeder_id)) &&
    String(feeders.find(f => String(f.id) === String(device.feeder_id))?.substation_id) !== String(device.substation_id)
  );

  // The 10 devices are the ones that mismatch but feeder exists.
  // The user said there were 10. Let's list them.
  console.log(JSON.stringify(mismatchDevices.slice(0, 10).map(d => d.id), null, 2));
}

findSafeAutoFix().catch(console.error);
