const fs = require('fs');

function patchRepo(file, entityName, collectionName) {
  let code = fs.readFileSync(file, 'utf8');

  // Replace getCached imports
  code = code.replace(/import \{ getCached, setCached, invalidateCache, logFirebaseRead, logFirebaseWrite, logCacheHit \} from '\.\.\/\.\.\/utils\/firestoreCache';/g, 
    "import { getCached, setCached, invalidateCache, logFirebaseRead, logFirebaseWrite, logCacheHit, getOrFetchCached } from '../../utils/firestoreCache';");

  const oldGetByIdRegex = /async getById\(id: string\) \{[\s\S]*?const db = getTargetFirestore\(\);[\s\S]*?const doc = await db\.collection\('([^']+)'\)\.doc\(id\)\.get\(\);[\s\S]*?logFirebaseRead\([^;]+\);[\s\S]*?if \(!doc\.exists \|\| doc\.data\(\)\?\.isDeleted\) return null;[\s\S]*?const data = \{ id: doc\.id, \.\.\.doc\.data\(\) \}( as [a-zA-Z]+)?;[\s\S]*?setCached\(cacheKey, data, 300000\);[\s\S]*?return data;[\s\S]*?\}/m;

  const getByIdBody = `async getById(id: string) {
    const cacheKey = \`${entityName}_doc_\${id}\`;
    return getOrFetchCached(cacheKey, 300000, async () => {
        const db = getTargetFirestore();
        const doc = await db.collection('${collectionName}').doc(id).get();
        logFirebaseRead('${collectionName}', \`doc(\${id})\`, doc.exists ? 1 : 0);
        if (!doc.exists || doc.data()?.isDeleted) return null;
        const data = { id: doc.id, ...doc.data() };
        return data as any;
    });
  }`;

  code = code.replace(oldGetByIdRegex, getByIdBody);
  fs.writeFileSync(file, code);
  console.log('Patched', file);
}

patchRepo('server/repositories/firestore/substationRepository.ts', 'substation', 'substations');
patchRepo('server/repositories/firestore/feederRepository.ts', 'feeder', 'feeders');
patchRepo('server/repositories/firestore/deviceRepository.ts', 'device', 'devices');

