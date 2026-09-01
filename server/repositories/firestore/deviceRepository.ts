import { getTargetFirestore } from '../../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getCached, setCached, invalidateCache, logFirebaseRead, logFirebaseWrite, logCacheHit } from '../../utils/firestoreCache';

export type Device = {
  id: string;
  device_id: string;
  name: string;
  substation_id: string | number;
  feeder_id: string | number;
  device_type: string;
  status: string;
  version: number;
  createdAt: any;
  updatedAt: any;
  isDeleted: boolean;
  lastOperationId?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  manufacturer?: string;
  installation_date?: string;
  switch_status?: string; 
  scada_status?: string;
  relay_79?: string;
  battery_status?: string;
  settings?: string;
  device_code?: string;
  pole_number?: string;
  unit?: string;
  team?: string;
  notes?: string;
  createdBy?: string;
  updatedBy?: string; 
};

export type DeviceCreateInput = Omit<Device, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'lastOperationId'>;

export interface DeviceListOptions {
  substation_id?: string | number;
  feeder_id?: string | number;
  device_type?: string;
  status?: string;
  limit?: number;
  lastDocId?: string;
}

export const deviceRepo = {
  async list(options?: DeviceListOptions) {
    const subId = options?.substation_id !== undefined ? String(options.substation_id) : undefined;
    const feedId = options?.feeder_id !== undefined ? String(options.feeder_id) : undefined;
    const type = options?.device_type;
    const st = options?.status;
    const limit = options?.limit || 10;
    const lastDocId = options?.lastDocId;

    const cacheKey = `devices_list_${subId || 'all'}_${feedId || 'all'}_${type || 'all'}_${st || 'all'}_${limit || 'all'}_${lastDocId || 'none'}`;
    const cached = getCached<Device[]>(cacheKey);
    if (cached) {
      logCacheHit('devices', cacheKey);
      return cached;
    }

    const db = getTargetFirestore();
    let query: FirebaseFirestore.Query = db.collection('devices').where('isDeleted', '==', false);

    if (subId) {
      const numSubId = Number(subId);
      if (!isNaN(numSubId) && String(numSubId) === subId) {
        query = query.where('substation_id', 'in', [subId, numSubId]);
      } else {
        query = query.where('substation_id', '==', subId);
      }
    }
    if (feedId) {
      const numFeedId = Number(feedId);
      if (!isNaN(numFeedId) && String(numFeedId) === feedId) {
        query = query.where('feeder_id', 'in', [feedId, numFeedId]);
      } else {
        query = query.where('feeder_id', '==', feedId);
      }
    }
    if (type) {
      const dt = type.toUpperCase() === 'RCL' ? 'REC' : type.toUpperCase();
      query = query.where('device_type', '==', dt);
    }
    if (st) {
      query = query.where('status', '==', st);
    }
    if (limit) {
      query = query.limit(Number(limit));
    }
    
    if (lastDocId) {
      const docSnap = await db.collection('devices').doc(lastDocId).get();
      if (docSnap.exists) {
        query = query.startAfter(docSnap);
      }
    }

    const snapshot = await query.get();
    const queryDesc = `sub=${subId || 'any'},feed=${feedId || 'any'},type=${type || 'any'},limit=${limit || 'none'}`;
    logFirebaseRead('devices', queryDesc, snapshot.size);

    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Device[];
    setCached(cacheKey, list, 30000); 
    return list;
  },

  async listByFeederId(feederId: string | number) {
    return this.list({ feeder_id: feederId });
  },

  async listBySubstationId(substationId: string | number) {
    return this.list({ substation_id: substationId });
  },

  async count(options?: { substation_id?: string | number; feeder_id?: string | number }) {
    const subId = options?.substation_id !== undefined ? String(options.substation_id) : undefined;
    const feedId = options?.feeder_id !== undefined ? String(options.feeder_id) : undefined;

    const cacheKey = `devices_count_${subId || 'all'}_${feedId || 'all'}`;
    const cached = getCached<number>(cacheKey);
    if (cached !== null) {
      logCacheHit('devices_count', cacheKey);
      return cached;
    }

    const db = getTargetFirestore();
    let query: FirebaseFirestore.Query = db.collection('devices').where('isDeleted', '==', false);

    if (subId) {
      const numSubId = Number(subId);
      if (!isNaN(numSubId) && String(numSubId) === subId) {
        query = query.where('substation_id', 'in', [subId, numSubId]);
      } else {
        query = query.where('substation_id', '==', subId);
      }
    }
    if (feedId) {
      const numFeedId = Number(feedId);
      if (!isNaN(numFeedId) && String(numFeedId) === feedId) {
        query = query.where('feeder_id', 'in', [feedId, numFeedId]);
      } else {
        query = query.where('feeder_id', '==', feedId);
      }
    }

    const snap = await query.count().get();
    const count = snap.data().count;
    logFirebaseRead('devices', `count(${subId || 'all'}, ${feedId || 'all'})`, count);
    setCached(cacheKey, count, 30000);
    return count;
  },
  
  async getById(id: string) {
    const cacheKey = `device_doc_${id}`;
    const cached = getCached<Device>(cacheKey);
    if (cached) {
      logCacheHit('device', cacheKey);
      return cached;
    }

    const db = getTargetFirestore();
    const doc = await db.collection('devices').doc(id).get();
    logFirebaseRead('devices', `doc(${id})`, doc.exists ? 1 : 0);
    
    if (!doc.exists || doc.data()?.isDeleted === true) return null;

    const data = { id: doc.id, ...doc.data() } as Device;
    setCached(cacheKey, data, 30000);
    return data;
  },

  async getByDeviceId(deviceId: string) {
    const db = getTargetFirestore();
    const snapshot = await db.collection('devices')
        .where('device_id', '==', deviceId)
        .where('isDeleted', '==', false) 
        .limit(1)
        .get();
        
    logFirebaseRead('devices', `device_id=${deviceId}`, snapshot.size);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Device;
  },

  async create(data: DeviceCreateInput, operationId: string) {
    const db = getTargetFirestore();
    return await db.runTransaction(async (transaction) => {
        const eventRef = db.collection('operation_events').doc(operationId);
        const eventDoc = await transaction.get(eventRef);
        if (eventDoc.exists) return eventDoc.data()?.result;

        const docRef = db.collection('devices').doc();
        const now = FieldValue.serverTimestamp();
        
        const docData = {
            ...data,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            lastOperationId: operationId,
            status: data.status || 'ACTIVE',
            device_type: data.device_type || 'OTHER'
        };

        transaction.set(docRef, docData);
        transaction.set(eventRef, { operationId, result: { id: docRef.id, ...docData } });

        invalidateCache('devices');
        invalidateCache('dashboard_stats');
        logFirebaseWrite('devices', docRef.id, 'CREATE');
        return { id: docRef.id, ...docData } as Device;
    });
  },

  async update(id: string, data: Partial<Device>, expectedVersion: number, operationId: string) {
    const db = getTargetFirestore();
    return await db.runTransaction(async (transaction) => {
        const docRef = db.collection('devices').doc(id);
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

        invalidateCache('devices');
        invalidateCache(`device_doc_${id}`);
        invalidateCache('dashboard_stats');
        logFirebaseWrite('devices', id, 'UPDATE');
        return { id: doc.id, ...updateData };
    });
  },

  async delete(id: string, operationId: string, deletedBy: string) {
    const db = getTargetFirestore();
    return await db.runTransaction(async (transaction) => {
        const docRef = db.collection('devices').doc(id);
        const doc = await transaction.get(docRef);
        if (!doc.exists) throw new Error('NOT_FOUND');
        
        const currentData = doc.data()!;
        
        const backupRef = db.collection('deleted_devices_backup').doc();
        transaction.set(backupRef, {
            ...currentData,
            originalId: doc.id,
            deletedBy,
            deletedAt: FieldValue.serverTimestamp(),
            deleteBatchId: operationId
        });
        
        transaction.delete(docRef);
        
        invalidateCache('devices');
        invalidateCache(`device_doc_${id}`);
        invalidateCache('dashboard_stats');
        logFirebaseWrite('devices', id, 'DELETE');
        return { id: doc.id };
    });
  }
};
