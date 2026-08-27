import { getTargetFirestore } from './server/firebaseAdmin.js';
(async () => {
  try {
    const db = getTargetFirestore();
    const snapshot = await db.collection('devices').get();
    console.log("SUCCESS:", snapshot.docs.map(d => ({id: d.id, ...d.data()})));
  } catch(e) {
    console.error("ERROR:", e);
  }
})();
