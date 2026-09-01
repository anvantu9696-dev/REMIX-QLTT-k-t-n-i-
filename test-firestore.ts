import { getTargetFirestore } from './server/firebaseAdmin';
async function run() {
  const db = getTargetFirestore();
  const users = await db.collection('users').get();
  users.forEach(doc => {
    console.log(doc.id, doc.data().username, doc.data().full_name, doc.data().role, doc.data().status);
  });
}
run();
