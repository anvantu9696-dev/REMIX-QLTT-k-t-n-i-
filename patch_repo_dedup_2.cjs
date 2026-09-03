const fs = require('fs');

function patchRepo(file, entityName, collectionName) {
  let code = fs.readFileSync(file, 'utf8');

  // Replace getCached imports
  code = code.replace(/import \{ getCached, setCached, invalidateCache, logFirebaseRead, logFirebaseWrite, logCacheHit \} from '\.\.\/\.\.\/utils\/firestoreCache';/g, 
    "import { getCached, setCached, invalidateCache, logFirebaseRead, logFirebaseWrite, logCacheHit, getOrFetchCached } from '../../utils/firestoreCache';");

  const startIdx = code.indexOf('async getById(id: string)');
  if (startIdx !== -1) {
    const endIdx = code.indexOf('  },', startIdx);
    if (endIdx !== -1) {
        const getByIdBody = `async getById(id: string) {
    const cacheKey = \`${entityName}_doc_\${id}\`;
    return getOrFetchCached(cacheKey, 300000, async () => {
        const db = getTargetFirestore();
        const doc = await db.collection('${collectionName}').doc(id).get();
        logFirebaseRead('${collectionName}', \`doc(\${id})\`, doc.exists ? 1 : 0);
        if (!doc.exists || doc.data()?.isDeleted) return null;
        const data = { id: doc.id, ...doc.data() };
        return data as any;
    });`;
        code = code.substring(0, startIdx) + getByIdBody + code.substring(endIdx);
    }
  }

  fs.writeFileSync(file, code);
  console.log('Patched', file);
}

patchRepo('server/repositories/firestore/substationRepository.ts', 'substation', 'substations');
patchRepo('server/repositories/firestore/feederRepository.ts', 'feeder', 'feeders');
patchRepo('server/repositories/firestore/deviceRepository.ts', 'device', 'devices');

