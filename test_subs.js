const admin = require('firebase-admin');
const sa = require('./firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
async function run() {
  const s = await db.collection('substations').get();
  console.log(s.docs.map(d => ({ docId: d.id, id: d.data().id, name: d.data().name })));
}
run();
