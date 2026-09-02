import { getTargetFirestore } from './server/firebaseAdmin';
async function run() {
  const db = getTargetFirestore();
  const snapshot = await db.collection('users').get();
  console.log('User count in Firestore:', snapshot.size);
  snapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log('UID:', data.uid, 'Username:', data.username, 'Role:', data.role, 'Email:', data.email);
  });
}
run();
