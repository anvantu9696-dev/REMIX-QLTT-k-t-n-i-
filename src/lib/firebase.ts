import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

let firestoreInstance;
try {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  console.warn("Falling back to default Firestore database", e);
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;


