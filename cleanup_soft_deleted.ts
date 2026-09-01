import { getTargetFirestore } from './server/firebaseAdmin';

async function runCleanup() {
    const db = getTargetFirestore();
    const collections = ['devices', 'feeders', 'substations'];
    let totalMoved = 0;

    for (const coll of collections) {
        console.log(`Processing collection: ${coll}...`);
        const snapshot = await db.collection(coll).where('isDeleted', '==', true).get();
        
        if (snapshot.empty) {
            console.log(`No soft-deleted records found in ${coll}.`);
            continue;
        }

        const archiveColl = `${coll}_archive`;
        let batch = db.batch();
        let operationCount = 0;
        let chunkCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const archiveRef = db.collection(archiveColl).doc(doc.id);
            const originalRef = db.collection(coll).doc(doc.id);

            batch.set(archiveRef, data);
            batch.delete(originalRef);
            
            operationCount += 2; // set and delete

            if (operationCount >= 400) { // Max 500 ops per batch, 400 is safe
                await batch.commit();
                chunkCount++;
                console.log(`Committed chunk ${chunkCount} for ${coll} (${operationCount / 2} items).`);
                batch = db.batch();
                operationCount = 0;
            }
        }

        if (operationCount > 0) {
            await batch.commit();
            chunkCount++;
            console.log(`Committed final chunk ${chunkCount} for ${coll} (${operationCount / 2} items).`);
        }

        console.log(`Finished ${coll}. Total archived/deleted: ${snapshot.size}`);
        totalMoved += snapshot.size;
    }

    console.log(`Cleanup complete. Total records moved to archive: ${totalMoved}`);
}

runCleanup().catch(console.error);
