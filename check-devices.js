import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit } from 'firebase/firestore';
const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);
async function run() {
  const snap = await getDocs(collection(db, 'devices'));
  console.log("Total devices:", snap.size);
  let missingIsDeleted = 0;
  snap.forEach(d => {
    if (d.data().isDeleted === undefined) missingIsDeleted++;
  });
  console.log("Missing isDeleted:", missingIsDeleted);
}
run();
