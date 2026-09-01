import { getTargetFirestore } from '../firebaseAdmin';
import * as fs from 'fs';

async function listCandidates() {
  const db = getTargetFirestore();
  const snapshot = await db.collection('devices')
      .get();
      
  const devices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  fs.writeFileSync('./all_devices.json', JSON.stringify(devices, null, 2));
  console.log(`Exported ${devices.length} devices to ./all_devices.json`);
}

listCandidates().catch(console.error);
