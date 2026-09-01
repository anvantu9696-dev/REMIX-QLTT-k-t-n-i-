import { getTargetFirestore } from './server/firebaseAdmin';

async function fixTypeMismatch(): Promise<void> {
  try {
    const db = getTargetFirestore();
    const [devicesSnap, feedersSnap] = await Promise.all([
      db.collection('devices').get(),
      db.collection('feeders').get()
    ]);

    const updates: { ref: FirebaseFirestore.DocumentReference; data: Record<string, any> }[] = [];

    const processDocs = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => {
      for (const doc of docs) {
        const data = doc.data();
        let needsUpdate = false;
        const updateData: Record<string, any> = {};

        if (data.feeder_id !== undefined && typeof data.feeder_id === 'number') {
          updateData.feeder_id = String(data.feeder_id);
          needsUpdate = true;
        }
        if (data.substation_id !== undefined && typeof data.substation_id === 'number') {
          updateData.substation_id = String(data.substation_id);
          needsUpdate = true;
        }

        if (needsUpdate) {
          updates.push({ ref: doc.ref, data: updateData });
        }
      }
    };

    processDocs(devicesSnap.docs);
    processDocs(feedersSnap.docs);

    if (updates.length === 0) {
      console.log("Không có dữ liệu nào cần fix type mismatch.");
      return;
    }

    const CHUNK_SIZE = 500;
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      const batch = db.batch();

      for (const update of chunk) {
        batch.update(update.ref, update.data);
      }

      await batch.commit();
      console.log(`Đã xử lý batch ${Math.floor(i / CHUNK_SIZE) + 1} (${chunk.length} bản ghi) - Ép kiểu thành String thành công.`);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

fixTypeMismatch();
