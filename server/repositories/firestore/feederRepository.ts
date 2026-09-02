import { getTargetFirestore } from '../../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getCached, setCached, invalidateCache, logFirebaseRead, logFirebaseWrite, logCacheHit } from '../../utils/firestoreCache';

export type Feeder = {
  id: string;
  substation_id: string | number;
  feeder_code: string;
  name: string;
  status: string;
  version: number;
  createdAt: any;
  updatedAt: any;
  isDeleted: boolean;
  lastOperationId?: string;
  createdBy: string;
  updatedBy: string;
  voltage_level?: string;
  start_point?: string;
  end_point?: string;
};

export type FeederCreateInput = Omit<Feeder, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'lastOperationId'>;

const CACHE_KEY_ALL = 'feeders_list_all';

export const feederRepo = {
  async list(options?: { substation_id?: string | number; status?: string; limit?: number; lastDocId?: string }) {
    const subId = options?.substation_id !== undefined ? String(options.substation_id) : undefined;
    const cacheKey = `feeders_list_${subId || 'all'}_${options?.status || 'all'}_${options?.limit || 'all'}_${options?.lastDocId || 'none'}`;

    const cached = getCached<Feeder[]>(cacheKey);
    if (cached) {
      logCacheHit('feeders', cacheKey);
      return cached;
    }

    const db = getTargetFirestore();
    let query: FirebaseFirestore.Query = db.collection('feeders').where('isDeleted', '==', false);

    if (subId) {
      const numSubId = Number(subId);
      if (!isNaN(numSubId) && String(numSubId) === subId) {
        query = query.where('substation_id', 'in', [subId, numSubId]);
      } else {
        query = query.where('substation_id', '==', subId);
      }
    }
    if (options?.status) {
      query = query.where('status', '==', options.status);
    }

    if (options?.lastDocId) {
      const docSnap = await db.collection('feeders').doc(options.lastDocId).get();
      if (docSnap.exists) {
        query = query.startAfter(docSnap);
      }
    }

    const limit = options?.limit || 500;
    if (limit) {
      query = query.limit(limit);
      
    }

    const snapshot = await query.get();
    const queryDesc = `sub=${subId || 'any'},status=${options?.status || 'any'},limit=${options?.limit || 'none'}`;
    logFirebaseRead('feeders', queryDesc, snapshot.size);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Feeder[];

    setCached(cacheKey, list, 60000);
    return list;
  },

  async listBySubstationId(substationId: string | number) {
    return this.list({ substation_id: substationId });
  },

  async count(options?: { substation_id?: string | number }) {
    const subId = options?.substation_id !== undefined ? String(options.substation_id) : undefined;
    const cacheKey = subId ? `feeders_count_sub_${subId}` : 'feeders_count_all';

    const cached = getCached<number>(cacheKey);
    if (cached !== null) {
      logCacheHit('feeders_count', cacheKey);
      return cached;
    }

    const db = getTargetFirestore();
    let query = db.collection('feeders').where('isDeleted', '==', false);

    if (subId) {
      const numSubId = Number(subId);
      if (!isNaN(numSubId) && String(numSubId) === subId) {
        query = query.where('substation_id', 'in', [subId, numSubId]);
      } else {
        query = query.where('substation_id', '==', subId);
      }
    }

    const snap = await query.count().get();
    const count = snap.data().count;
    logFirebaseRead('feeders', subId ? `count(substation_id=${subId})` : 'count(isDeleted=false)', count);
    setCached(cacheKey, count, 60000);
    return count;
  },
  
  async getById(id: string) {
    const cacheKey = `feeder_doc_${id}`;
    const cached = getCached<Feeder>(cacheKey);
    if (cached) {
      logCacheHit('feeder', cacheKey);
      return cached;
    }

    const db = getTargetFirestore();
    const doc = await db.collection('feeders').doc(id).get();
    logFirebaseRead('feeders', `doc(${id})`, doc.exists ? 1 : 0);
    
    if (!doc.exists || doc.data()?.isDeleted === true) return null;

    const data = { id: doc.id, ...doc.data() } as Feeder;
    setCached(cacheKey, data, 60000);
    return data;
  },

  async findByCode(code: string) {
      const db = getTargetFirestore();
      const snapshot = await db.collection('feeders')
          .where('feeder_code', '==', code)
          .where('isDeleted', '==', false)
          .limit(1)
          .get();
      logFirebaseRead('feeders', `feeder_code=${code}`, snapshot.size);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Feeder;
  },

  async exists(id: string) {
      const doc = await this.getById(id);
      return doc !== null && !doc.isDeleted;
  },

  async create(data: FeederCreateInput, operationId: string) {
    const db = getTargetFirestore();
    return await db.runTransaction(async (transaction) => {
        const eventRef = db.collection('operation_events').doc(operationId);
        const eventDoc = await transaction.get(eventRef);
        if (eventDoc.exists) return eventDoc.data()?.result;

        const docRef = db.collection('feeders').doc();
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
        
        invalidateCache('feeders');
        invalidateCache('dashboard_stats');
        logFirebaseWrite('feeders', docRef.id, 'CREATE');
        return { id: docRef.id, ...docData } as Feeder;
    });
  },

  async update(id: string, data: Partial<Feeder>, expectedVersion: number, operationId: string) {
    const db = getTargetFirestore();
    return await db.runTransaction(async (transaction) => {
        const docRef = db.collection('feeders').doc(id);
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
        
        invalidateCache('feeders');
        invalidateCache(`feeder_doc_${id}`);
        invalidateCache('dashboard_stats');
        logFirebaseWrite('feeders', id, 'UPDATE');
        return { id: doc.id, ...updateData };
    });
  },

  async delete(id: string, operationId: string) {
    const db = getTargetFirestore();
    return await db.runTransaction(async (transaction) => {
        const docRef = db.collection('feeders').doc(id);
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
        
        invalidateCache('feeders');
        invalidateCache(`feeder_doc_${id}`);
        invalidateCache('dashboard_stats');
        logFirebaseWrite('feeders', id, 'DELETE');
        return { id: doc.id, ...updateData };
    });
  }
};
