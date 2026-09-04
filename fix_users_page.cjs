const fs = require('fs');
let code = fs.readFileSync('src/pages/UsersPage.tsx', 'utf8');

code = code.replace(
    /import \{ collection, getDocs, doc, updateDoc, deleteDoc \} from 'firebase\/firestore';/,
    "import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, limit } from 'firebase/firestore';"
);

code = code.replace(
    /const snapshot = await getDocs\(collection\(db, 'users'\)\);/,
    "const snapshot = await getDocs(query(collection(db, 'users'), where('deleted_at', '==', null), limit(100)));"
);

fs.writeFileSync('src/pages/UsersPage.tsx', code);
