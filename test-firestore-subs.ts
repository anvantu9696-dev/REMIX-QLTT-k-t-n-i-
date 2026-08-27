import { getTargetFirestore } from './server/firebaseAdmin.js';
(async () => {
  try {
    const db = getTargetFirestore();
    const subs = await db.collection('substations').get();
    console.log(subs.docs.map(d => ({id: d.id, name: d.data().name})));
  } catch(e) {
    console.error(e);
  }
})();
