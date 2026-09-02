import { getTargetAuth, getTargetFirestore } from './server/firebaseAdmin';

async function run() {
  const auth = getTargetAuth();
  const db = getTargetFirestore();
  
  const guestEmail = 'guest@scada.com';
  let guestUser;
  try {
    guestUser = await auth.getUserByEmail(guestEmail);
    console.log('Guest user exists in Auth:', guestUser.uid);
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      console.log('Guest user not found in Auth. Creating...');
      guestUser = await auth.createUser({
        email: guestEmail,
        password: 'GuestPassword123!',
        displayName: 'Guest User'
      });
      console.log('Created Guest in Auth:', guestUser.uid);
    } else {
      console.error('Error fetching guest user:', err);
      return;
    }
  }

  // Check Firestore
  const doc = await db.collection('users').doc(guestUser.uid).get();
  if (!doc.exists) {
    console.log('Guest user not found in Firestore. Creating...');
    await db.collection('users').doc(guestUser.uid).set({
      uid: guestUser.uid,
      email: guestEmail,
      username: 'guest',
      role: 'VIEWER',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('Created Guest in Firestore.');
  } else {
    console.log('Guest user exists in Firestore:', doc.data());
    if (doc.data()?.role !== 'VIEWER') {
        await db.collection('users').doc(guestUser.uid).update({ role: 'VIEWER', status: 'ACTIVE' });
        console.log('Updated role to VIEWER.');
    }
  }
}
run();
