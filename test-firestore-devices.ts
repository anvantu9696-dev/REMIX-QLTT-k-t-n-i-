import { getTargetFirestore } from './server/firebaseAdmin.js';
(async () => {
  try {
    const db = getTargetFirestore();
    const devices = await db.collection('devices').get();
    console.log(devices.docs.map(d => ({id: d.id, substation_id: d.data().substation_id, feeder_id: d.data().feeder_id})));
  } catch(e) {
    console.error(e);
  }
})();
