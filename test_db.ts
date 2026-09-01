import { getTargetFirestore } from './server/firebaseAdmin.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    const db = getTargetFirestore();
    const subs = await db.collection('substations').get();
    console.log("Substations:");
    subs.docs.forEach(d => console.log(d.id, d.data().substation_code, d.data().name, d.data().isDeleted));
}
run();
