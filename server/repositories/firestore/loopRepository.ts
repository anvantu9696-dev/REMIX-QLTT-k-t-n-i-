import { getTargetFirestore } from '../../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getCached, setCached, invalidateCache, logFirebaseRead, logFirebaseWrite, logCacheHit } from '../../utils/firestoreCache';

export type Loop = {
  id: string; // Document ID
  loop_id: string;
  name: string;
  substation_id_a: string;
  feeder_id_a: string;
  device_id_a: string;
  substation_id_b: string;
  feeder_id_b: string;
  device_id_b: string;
  loop_device_id?: string;
  status: string;
  operating_status?: string;
  config_status?: string;
  operation_status?: string;
  configuration_status?: string;
  latitude?: number;
  longitude?: number;
  google_maps_url?: string;
  inspection_cycle?: string;
  last_inspection_date?: string;
  next_inspection_date?: string;
  assigned_user_id?: string;
  notes?: string;
  createdAt: any;
  updatedAt: any;
  isDeleted: boolean;
  createdBy: string;
  updatedBy: string;
};

const CACHE_KEY_ALL = 'loops_list_all';

export const loopRepo = {
  async list(options?: { limit?: number }) {
    const cacheKey = options?.limit ? `loops_list_limit_${options.limit}` : CACHE_KEY_ALL;
    const cached = getCached<Loop[]>(cacheKey);
    if (cached) {
      logCacheHit('loops', cacheKey);
      return cached;
    }

    const db = getTargetFirestore();
    let query = db.collection('loops').where('isDeleted', '==', false);
    
    const limit = options?.limit || 500;
    if (limit) {
      query = query.limit(limit);
      
    }

    const snapshot = await query.get();
    logFirebaseRead('loops', options?.limit ? `limit=${options.limit}` : 'isDeleted=false', snapshot.size);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Loop[];
    
    setCached(cacheKey, list, 45000);
    return list;
  },

  async count() {
    const cached = getCached<number>('loops_count');
    if (cached !== null) {
      logCacheHit('loops_count');
      return cached;
    }

    const db = getTargetFirestore();
    const snap = await db.collection('loops').where('isDeleted', '==', false).count().get();
    const count = snap.data().count;
    logFirebaseRead('loops', 'count(isDeleted=false)', count);
    
    setCached('loops_count', count, 45000);
    return count;
  },
  
  async getById(id: string) {
    const cacheKey = `loop_doc_${id}`;
    const cached = getCached<Loop>(cacheKey);
    if (cached) {
      logCacheHit('loop', cacheKey);
      return cached;
    }

    const db = getTargetFirestore();
    
    // 1. Try direct doc ID
    const doc = await db.collection('loops').doc(id).get();
    if (doc.exists && doc.data()?.isDeleted !== true) { 
      logFirebaseRead('loops', `doc(${id})`, 1);
      const data = { id: doc.id, ...doc.data() } as Loop;
      setCached(cacheKey, data, 45000);
      return data;
    }

    // 2. Try querying by loop_id
    let snapshot = await db.collection('loops')
        .where('loop_id', '==', id)
        .where('isDeleted', '==', false)
        .limit(1).get();
    if (!snapshot.empty) {
      logFirebaseRead('loops', `loop_id=${id}`, 1);
      const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Loop;
      setCached(cacheKey, data, 45000);
      return data;
    }

    // 3. Try querying by loop_code
    snapshot = await db.collection('loops')
        .where('loop_code', '==', id)
        .where('isDeleted', '==', false)
        .limit(1).get();
    if (!snapshot.empty) {
      logFirebaseRead('loops', `loop_code=${id}`, 1);
      const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Loop;
      setCached(cacheKey, data, 45000);
      return data;
    }

    // 4. Try querying by numeric id if parseable
    const numId = Number(id);
    if (!isNaN(numId)) {
      snapshot = await db.collection('loops')
          .where('id', '==', numId)
          .where('isDeleted', '==', false)
          .limit(1).get();
      if (!snapshot.empty) {
        logFirebaseRead('loops', `id=${numId}`, 1);
        const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Loop;
        setCached(cacheKey, data, 45000);
        return data;
      }
    }

    return null;
  },

  async create(data: Partial<Loop>) {
    const db = getTargetFirestore();
    const docRef = db.collection('loops').doc();
    const now = FieldValue.serverTimestamp();
    const payload = {
        ...data,
        isDeleted: false,
        createdAt: now,
        updatedAt: now
    };
    await docRef.set(payload);
    invalidateCache('loops');
    invalidateCache('dashboard_stats');
    logFirebaseWrite('loops', docRef.id, 'CREATE');
    return { id: docRef.id, ...data };
  },

  async update(id: string, data: Partial<Loop>) {
    const db = getTargetFirestore();
    const docRef = db.collection('loops').doc(id);
    await docRef.update({
        ...data,
        updatedAt: FieldValue.serverTimestamp()
    });
    invalidateCache('loops');
    invalidateCache(`loop_doc_${id}`);
    invalidateCache('dashboard_stats');
    logFirebaseWrite('loops', id, 'UPDATE');
  },

  async delete(id: string, updatedBy: string) {
    const db = getTargetFirestore();
    const docRef = db.collection('loops').doc(id);
    await docRef.update({
        isDeleted: true,
        updatedBy,
        updatedAt: FieldValue.serverTimestamp()
    });
    invalidateCache('loops');
    invalidateCache(`loop_doc_${id}`);
    invalidateCache('dashboard_stats');
    logFirebaseWrite('loops', id, 'DELETE');
  }
};
