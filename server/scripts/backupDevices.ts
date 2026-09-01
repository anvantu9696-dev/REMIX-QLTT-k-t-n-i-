import { getTargetFirestore } from '../firebaseAdmin';
import * as fs from 'fs';
import * as path from 'path';

async function backupDevices() {
  const db = getTargetFirestore();
  const snapshot = await db.collection('devices').get();
  const devices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  const filename = `devices_backup_${Date.now()}.json`;
  fs.writeFileSync(path.join(backupDir, filename), JSON.stringify(devices, null, 2));
  console.log(`Backup created: ${filename}. Total devices: ${devices.length}`);
}

backupDevices().catch(console.error);
