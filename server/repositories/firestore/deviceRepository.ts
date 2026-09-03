import { getTargetFirestore } from '../../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getCached, setCached, invalidateCache, logFirebaseRead, logFirebaseWrite, logCacheHit, getOrFetchCached } from '../../utils/firestoreCache';

export type Device = {
  id: string;
  device_id: string;
  name: string;
  substation_id: string | number;
  feeder_id: string | number;
  substation_name?: string;
  feeder_name?: string;
  substation_code?: string;
  feeder_code?: string;
  device_type: string;
  status: string;
  version: number;
  createdAt: any;
  updatedAt: any;
  isDeleted: boolean;
  lastOperationId?: string;
  latitude?: number;
  longitude?: number;
  google_maps_url?: string;
  primary_image?: string;
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
    const limit = options?.limit || 50;
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
    setCached(cacheKey, list, 300000); 
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
    setCached(cacheKey, count, 300000);
    return count;
  },
  
  async getById(id: string) {
    const cacheKey = `device_doc_${id}`;
    return getOrFetchCached(cacheKey, 300000, async () => {
        const db = getTargetFirestore();
        const doc = await db.collection('devices').doc(id).get();
        logFirebaseRead('devices', `doc(${id})`, doc.exists ? 1 : 0);
        if (!doc.exists || doc.data()?.isDeleted) return null;
        const data = { id: doc.id, ...doc.data() };
        return data as any;
    });  },

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
        
        let substation_name = data.substation_name;
        if (data.substation_id && !substation_name) {
            const subDoc = await transaction.get(db.collection('substations').doc(String(data.substation_id)));
            if (subDoc.exists) {
                substation_name = subDoc.data()?.name;
                data.substation_code = subDoc.data()?.substation_code;
            }
        }
        let feeder_name = data.feeder_name;
        if (data.feeder_id && !feeder_name) {
            const fdDoc = await transaction.get(db.collection('feeders').doc(String(data.feeder_id)));
            if (fdDoc.exists) {
                feeder_name = fdDoc.data()?.name;
                data.feeder_code = fdDoc.data()?.feeder_code;
            }
        }

        const docData = {
            ...data,
            substation_name,
            substation_code: data.substation_code,
            feeder_name,
            feeder_code: data.feeder_code,
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
        let substation_name = data.substation_name !== undefined ? data.substation_name : currentData.substation_name;
        if (data.substation_id !== undefined && String(data.substation_id) !== String(currentData.substation_id)) {
            const subDoc = await transaction.get(db.collection('substations').doc(String(data.substation_id)));
            if (subDoc.exists) {
                substation_name = subDoc.data()?.name;
                data.substation_code = subDoc.data()?.substation_code;
            }
            else substation_name = undefined;
        }
        
        let feeder_name = data.feeder_name !== undefined ? data.feeder_name : currentData.feeder_name;
        if (data.feeder_id !== undefined && String(data.feeder_id) !== String(currentData.feeder_id)) {
            const fdDoc = await transaction.get(db.collection('feeders').doc(String(data.feeder_id)));
            if (fdDoc.exists) {
                feeder_name = fdDoc.data()?.name;
                data.feeder_code = fdDoc.data()?.feeder_code;
            }
            else feeder_name = undefined;
        }

        const updateData = {
            ...currentData,
            ...data,
            substation_name,
            substation_code: data.substation_code !== undefined ? data.substation_code : currentData.substation_code,
            feeder_name,
            feeder_code: data.feeder_code !== undefined ? data.feeder_code : currentData.feeder_code,
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
