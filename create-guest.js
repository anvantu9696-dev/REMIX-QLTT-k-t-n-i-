import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const email = 'guest@scada.com';
  const password = 'GuestPassword123!';
  let user;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    user = cred.user;
    console.log('Guest logged in:', user.uid);
  } catch (err) {
    console.error('Login error:', err);
    process.exit(1);
  }

  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: email,
      username: 'guest',
      role: 'VIEWER',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('Firestore user created.');
  } else {
    console.log('Firestore user exists.');
    await setDoc(userRef, { role: 'VIEWER', status: 'ACTIVE' }, { merge: true });
    console.log('Firestore user role updated to VIEWER.');
  }
  process.exit(0);
}
run();
