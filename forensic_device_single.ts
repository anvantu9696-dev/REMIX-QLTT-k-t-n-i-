import { getTargetFirestore } from './server/firebaseAdmin.js';

async function forensicDevice() {
  const db = getTargetFirestore();

  // Step 1: Raw Device Document
  const devicesSnap = await db.collection('devices').where('device_id', '==', 'REC-471GĐ-001').get();
  let deviceDoc = null;
  if (!devicesSnap.empty) {
    deviceDoc = devicesSnap.docs[0];
    const data = deviceDoc.data();
    console.log('--- Step 1: Device Document ---');
    console.log('ID:', deviceDoc.id);
    const safeFields = ['device_id', 'id', 'code', 'name', 'type', 'feeder_id', 'substation_id', 'feeder_name', 'substation_name', 'station', 'route', 'createdAt', 'updatedAt', 'isDeleted'];
    for (const field of safeFields) {
      if (data.hasOwnProperty(field)) console.log(`${field}:`, data[field]);
    }
  }

  // Step 2 & 3: Feeders
  const feedersSnap = await db.collection('feeders').get();
  const feeder152 = await db.collection('feeders').doc('152').get();
  
  console.log('\n--- Step 2: Feeder 152 ---');
  console.log('Exists:', feeder152.exists);
  if (feeder152.exists) console.log('Data:', JSON.stringify(feeder152.data()));

  console.log('\n--- Step 3: Feeder fields containing 152 ---');
  let count = 0;
  for (const doc of feedersSnap.docs) {
    const data = doc.data();
    for (const [key, val] of Object.entries(data)) {
      if (val === 152 || val === '152') {
        console.log(`Match: Doc=${doc.id}, Field=${key}, Value=${val}`);
        count++;
      }
    }
  }
  console.log('Count:', count);

  // Step 4: Substation 22
  const sub22 = await db.collection('substations').doc('22').get();
  const subsSnap = await db.collection('substations').get();
  
  console.log('\n--- Step 4: Substation 22 ---');
  console.log('Exists:', sub22.exists);
  if (sub22.exists) console.log('Data:', JSON.stringify(sub22.data()));

  console.log('\n--- Step 4: Substation fields containing 22 ---');
  count = 0;
  for (const doc of subsSnap.docs) {
    const data = doc.data();
    for (const [key, val] of Object.entries(data)) {
      if (val === 22 || val === '22') {
        console.log(`Match: Doc=${doc.id}, Field=${key}, Value=${val}`);
        count++;
      }
    }
  }
  console.log('Count:', count);
}

forensicDevice().catch(console.error);
