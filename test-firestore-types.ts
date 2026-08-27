import { getTargetFirestore } from './server/firebaseAdmin.js';
(async () => {
  try {
    const db = getTargetFirestore();
    const feeders = await db.collection('feeders').get();
    console.log(feeders.docs.map(d => ({id: d.id, substation_id: d.data().substation_id})));
  } catch(e) {
    console.error(e);
  }
})();
