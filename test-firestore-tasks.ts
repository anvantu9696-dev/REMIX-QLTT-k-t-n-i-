import { getTargetFirestore } from './server/firebaseAdmin.js';
(async () => {
  try {
    const db = getTargetFirestore();
    const tasks = await db.collection('tasks').get();
    console.log(tasks.docs.length);
  } catch(e) {
    console.error(e);
  }
})();
