import { getTargetFirestore } from '../firebaseAdmin';

async function listCollections() {
  const db = getTargetFirestore();
  const collections = await db.listCollections();
  collections.forEach(col => console.log(col.id));
}

listCollections().catch(console.error);
