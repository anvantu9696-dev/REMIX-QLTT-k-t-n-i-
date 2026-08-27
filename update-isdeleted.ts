import { getTargetFirestore } from './server/firebaseAdmin.js';
(async () => {
  try {
    const db = getTargetFirestore();
    const snapshot = await db.collection('devices').get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      if (doc.data().isDeleted === undefined) {
        batch.update(doc.ref, { isDeleted: false });
      }
    });
    
    // Also update substations and feeders just in case
    const subSnapshot = await db.collection('substations').get();
    subSnapshot.docs.forEach(doc => {
      if (doc.data().isDeleted === undefined) {
        batch.update(doc.ref, { isDeleted: false });
      }
    });

    const feederSnapshot = await db.collection('feeders').get();
    feederSnapshot.docs.forEach(doc => {
      if (doc.data().isDeleted === undefined) {
        batch.update(doc.ref, { isDeleted: false });
      }
    });

    await batch.commit();
    console.log("Updated legacy documents");
  } catch(e) {
    console.error("ERROR:", e);
  }
})();
