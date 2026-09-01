const admin = require('firebase-admin');
const serviceAccount = require('./server/firebase-service-account.json'); // Adjust path as needed

// Initialize Firebase Admin (This might need to be adjusted based on actual setup)
// Since I can't guarantee service account access, I'll rely on the existing setup logic if possible.
// Actually, I should use the project's existing firebaseAdmin.ts setup.
const { getTargetFirestore } = require('./server/firebaseAdmin');

async function listDevices() {
  const db = getTargetFirestore();
  const snapshot = await db.collection('devices')
      .where('isDeleted', '==', false)
      .get();
      
  const devices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`Found ${devices.length} active devices.`);
  
  // Look for a pattern in createdAt or lastOperationId
  // Let's print the first few
  console.log('First 5 devices:', devices.slice(0, 5));
}

listDevices().catch(console.error);
