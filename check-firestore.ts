import { getTargetFirestore } from './server/firebaseAdmin';
async function run() {
  const db = getTargetFirestore();
  const snapshot = await db.collection('devices').where('isDeleted', '==', false).get();
  console.log('Device count in Firestore:', snapshot.size);
  snapshot.docs.forEach(doc => {
      console.log('Device ID:', doc.data().device_id, 'Name:', doc.data().name);
  });
}
run();
