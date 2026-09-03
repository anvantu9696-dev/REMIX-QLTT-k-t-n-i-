const fs = require('fs');
let code = fs.readFileSync('server/repositories/firestore/substationRepository.ts', 'utf8');

const oldList = `  async list(options?: { status?: string; limit?: number }) {
    const cacheKey = options?.status ? \`substations_list_\${options.status}\` : CACHE_KEY_ALL;
    const cached = getCached<Substation[]>(cacheKey);
    if (cached) {
      logCacheHit('substations', cacheKey);
      return cached;
    }
    const db = getTargetFirestore();
    let query = db.collection('substations').where('isDeleted', '==', false);
    
    if (options?.status) {
      query = query.where('status', '==', options.status);
    }
    const limit = options?.limit || 50;
    if (limit) {
      query = query.limit(limit);
      
    }
    const snapshot = await query.get();
    logFirebaseRead('substations', options?.status ? \`status=\${options.status}\` : 'isDeleted=false', snapshot.size);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Substation[];
    
    setCached(cacheKey, list, 300000);
    return list;
  },`;

const newList = `  async list(options?: { status?: string; limit?: number; lastDocId?: string }) {
    const limit = options?.limit || 50;
    const cacheKey = \`substations_list_\${options?.status || 'all'}_\${limit}_\${options?.lastDocId || 'none'}\`;
    const cached = getCached<Substation[]>(cacheKey);
    if (cached) {
      logCacheHit('substations', cacheKey);
      return cached;
    }
    const db = getTargetFirestore();
    let query = db.collection('substations').where('isDeleted', '==', false);
    
    if (options?.status) {
      query = query.where('status', '==', options.status);
    }
    query = query.orderBy('createdAt', 'desc');

    if (options?.lastDocId) {
      const lastDoc = await db.collection('substations').doc(options.lastDocId).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    if (limit) {
      query = query.limit(limit);
    }
    const snapshot = await query.get();
    logFirebaseRead('substations', \`status=\${options?.status || 'any'},limit=\${limit}\`, snapshot.size);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Substation[];
    
    setCached(cacheKey, list, 300000);
    return list;
  },`;

code = code.replace(oldList, newList);
fs.writeFileSync('server/repositories/firestore/substationRepository.ts', code);
console.log('Patched substationRepository for pagination');
