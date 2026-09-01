import { getTargetFirestore } from '../../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getCached, setCached, invalidateCache, logFirebaseRead, logFirebaseWrite, logCacheHit } from '../../utils/firestoreCache';

export type Substation = {
  id: string;
  substation_code: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  status: string;
  version: number;
  createdAt: any;
  updatedAt: any;
  isDeleted: boolean;
  lastOperationId?: string;
};

export type SubstationCreateInput = Omit<Substation, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'lastOperationId'>;

const CACHE_KEY_ALL = 'substations_list_all';

export const substationRepo = {
  async list(options?: { status?: string; limit?: number }) {
    const cacheKey = options?.status ? `substations_list_${options.status}` : CACHE_KEY_ALL;
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
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    logFirebaseRead('substations', options?.status ? `status=${options.status}` : 'isDeleted=false', snapshot.size);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Substation[];
    
    setCached(cacheKey, list, 60000);
    return list;
  },

  async count() {
    const cached = getCached<number>('substations_count');
    if (cached !== null) {
      logCacheHit('substations_count');
      return cached;
    }

    const db = getTargetFirestore();
    const snap = await db.collection('substations').where('isDeleted', '==', false).count().get();
    const count = snap.data().count;
    logFirebaseRead('substations', 'count(isDeleted=false)', count);
    
    setCached('substations_count', count, 60000);
    return count;
  },
  
  async getById(id: string) {
    const cacheKey = `substation_doc_${id}`;
    const cached = getCached<Substation>(cacheKey);
    if (cached) {
      logCacheHit('substation', cacheKey);
      return cached;
    }

    const db = getTargetFirestore();
    const doc = await db.collection('substations').doc(id).get();
    logFirebaseRead('substations', `doc(${id})`, doc.exists ? 1 : 0);
    
    if (!doc.exists || doc.data()?.isDeleted === true) return null;

    const data = { id: doc.id, ...doc.data() } as Substation;
    setCached(cacheKey, data, 60000);
    return data;
  },

  async findByCode(code: string) {
    const db = getTargetFirestore();
    const snapshot = await db.collection('substations')
        .where('substation_code', '==', code)
        .where('isDeleted', '==', false)
        .limit(1)
        .get();
    logFirebaseRead('substations', `substation_code=${code}`, snapshot.size);
    
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Substation;
  },

  async exists(id: string) {
      const doc = await this.getById(id);
      return doc !== null && !doc.isDeleted;
  },

  async create(data: SubstationCreateInput, operationId: string) {
    const db = getTargetFirestore();
    return await db.runTransaction(async (transaction) => {
        const eventRef = db.collection('operation_events').doc(operationId);
        const eventDoc = await transaction.get(eventRef);
        if (eventDoc.exists) return eventDoc.data()?.result;

        const docRef = db.collection('substations').doc();
        const now = FieldValue.serverTimestamp();
        
        const docData = {
            ...data,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            lastOperationId: operationId
        };

        transaction.set(docRef, docData);
        transaction.set(eventRef, { operationId, result: { id: docRef.id, ...docData } });
        
        invalidateCache('substations');
        invalidateCache('dashboard_stats');
        logFirebaseWrite('substations', docRef.id, 'CREATE');
        return { id: docRef.id, ...docData } as Substation;
    });
  },

  async update(id: string, data: Partial<Substation>, expectedVersion: number, operationId: string) {
    const db = getTargetFirestore();
    return await db.runTransaction(async (transaction) => {
        const docRef = db.collection('substations').doc(id);
        const doc = await transaction.get(docRef);
        if (!doc.exists || doc.data()?.isDeleted) throw new Error('NOT_FOUND');
        
        const currentData = doc.data()!;
        if (currentData.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
        if (currentData.lastOperationId === operationId) return currentData;

        const now = FieldValue.serverTimestamp();
        const updateData = {
            ...currentData,
            ...data,
            version: currentData.version + 1,
            updatedAt: now,
            lastOperationId: operationId
        };

        transaction.update(docRef, updateData);
        
        invalidateCache('substations');
        invalidateCache(`substation_doc_${id}`);
        invalidateCache('dashboard_stats');
        logFirebaseWrite('substations', id, 'UPDATE');
        return { id: doc.id, ...updateData };
    });
  },

  async delete(id: string, operationId: string) {
    const db = getTargetFirestore();
    return await db.runTransaction(async (transaction) => {
        const docRef = db.collection('substations').doc(id);
        const doc = await transaction.get(docRef);
        if (!doc.exists || doc.data()?.isDeleted) throw new Error('NOT_FOUND');
        
        const currentData = doc.data()!;
        if (currentData.lastOperationId === operationId) return currentData;

        const now = FieldValue.serverTimestamp();
        const updateData = {
            ...currentData,
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
            version: currentData.version + 1,
            lastOperationId: operationId
        };

        transaction.update(docRef, updateData);
        
        invalidateCache('substations');
        invalidateCache(`substation_doc_${id}`);
        invalidateCache('dashboard_stats');
        logFirebaseWrite('substations', id, 'DELETE');
        return { id: doc.id, ...updateData };
    });
  }
};
