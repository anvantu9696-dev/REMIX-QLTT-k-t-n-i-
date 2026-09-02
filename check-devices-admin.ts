import { getTargetFirestore } from './server/firebaseAdmin';

async function run() {
  const db = getTargetFirestore();
  const snap = await db.collection('devices').get();
  console.log("Total devices:", snap.size);
  let missingIsDeleted = 0;
  snap.forEach(d => {
    if (d.data().isDeleted === undefined) missingIsDeleted++;
  });
  console.log("Missing isDeleted:", missingIsDeleted);
}
run();
