import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0923315678",
  appId: "1:564908824564:web:f74df5004c152e6b938ba1",
  apiKey: "AIzaSyDZDLmcbmUpdspDOwnGNinhnTEv36CkZjM",
  authDomain: "gen-lang-client-0923315678.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-qunlthitbliin11-9296ab92-97c7-4c72-b30c-d73e7b59bc71",
  storageBucket: "gen-lang-client-0923315678.firebasestorage.app",
  messagingSenderId: "564908824564",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-qunlthitbliin11-9296ab92-97c7-4c72-b30c-d73e7b59bc71");
