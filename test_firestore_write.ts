import { getTargetFirestore } from './server/firebaseAdmin';

async function testFirestoreWrite() {
  const db = getTargetFirestore();
  const testData = {
    device_id: 'TEST_DEV_001',
    name: 'Thiết bị test',
    device_type: 'LBS',
    createdAt: new Date().toISOString(),
    isDeleted: false
  };
  
  try {
    const docRef = await db.collection('devices').add(testData);
    console.log(`Test device created with ID: ${docRef.id}`);
    
    // Cleanup
    await docRef.delete();
    console.log('Test device deleted.');
  } catch (err: any) {
    console.error('Test write failed:', err);
  }
}

testFirestoreWrite().catch(console.error);
