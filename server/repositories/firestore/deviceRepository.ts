import { getTargetFirestore } from '../../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getCached, setCached, invalidateNamespace, logFirebaseRead, logFirebaseWrite, logCacheHit, getOrFetchCached, TTL_DEVICES_LIST, TTL_ACTIVE_DEVICES } from '../../utils/firestoreCache';
import { dashboardStatsRepo } from './dashboardStatsRepository';

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
  async listDelta(updatedAfter: string | Date): Promise<{ devices: Device[]; last_sync_timestamp: string }> {
    const db = getTargetFirestore();
    const dateObj = typeof updatedAfter === 'string' ? new Date(updatedAfter) : updatedAfter;
    if (isNaN(dateObj.getTime())) {
      throw new Error('INVALID_TIMESTAMP');
    }

    const isoStr = dateObj.toISOString();
    const nowIso = new Date().toISOString();

    // Query documents updated after timestamp (including isDeleted: true for deletion sync)
    // Support both native Firestore Timestamp and ISO string formats
    const [snapDate, snapStr] = await Promise.all([
      db.collection('devices').where('updatedAt', '>', dateObj).get(),
      db.collection('devices').where('updatedAt', '>', isoStr).get().catch(() => ({ docs: [] }))
    ]);

    const docsMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    snapDate.docs.forEach(doc => docsMap.set(doc.id, doc));
    snapStr.docs.forEach(doc => docsMap.set(doc.id, doc));

    const totalCount = docsMap.size;
    logFirebaseRead('devices', `delta(updatedAfter=${isoStr})`, totalCount);

    const devices = Array.from(docsMap.values()).map(doc => {
      const data = doc.data()!;
      return {
        id: doc.id,
        ...data,
        isDeleted: !!data.isDeleted
      };
    }) as Device[];

    return {
      devices,
      last_sync_timestamp: nowIso
    };
  },

  async getAllActive(): Promise<Device[]> {
    const cacheKey = 'devices_all_active';
    return getOrFetchCached(cacheKey, TTL_ACTIVE_DEVICES, async () => {
      const db = getTargetFirestore();
      const snapshot = await db.collection('devices').where('isDeleted', '==', false).get();
      logFirebaseRead('devices', 'all_active', snapshot.size);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Device[];
    }, 'devices');
  },

  async list(options?: DeviceListOptions) {
    const subId = options?.substation_id !== undefined ? String(options.substation_id) : undefined;
    const feedId = options?.feeder_id !== undefined ? String(options.feeder_id) : undefined;
    const type = options?.device_type;
    const st = options?.status;
    const limit = options?.limit || 50;
    const lastDocId = options?.lastDocId;

    const all = await this.getAllActive();

    let filtered = all.filter(d => {
      if (subId && subId !== 'all' && subId !== 'ALL') {
        const numSubId = Number(subId);
        const matchStr = String(d.substation_id) === subId;
        const matchNum = !isNaN(numSubId) && Number(d.substation_id) === numSubId;
        if (!matchStr && !matchNum) return false;
      }
      if (feedId && feedId !== 'all' && feedId !== 'ALL') {
        const numFeedId = Number(feedId);
        const matchStr = String(d.feeder_id) === feedId;
        const matchNum = !isNaN(numFeedId) && Number(d.feeder_id) === numFeedId;
        if (!matchStr && !matchNum) return false;
      }
      if (type && type !== 'all') {
        const dt = type.toUpperCase() === 'RCL' ? 'REC' : type.toUpperCase();
        const dType = (d.device_type || '').toUpperCase() === 'RCL' ? 'REC' : (d.device_type || '').toUpperCase();
        if (dType !== dt) return false;
      }
      if (st && st !== 'all' && d.status !== st) {
        return false;
      }
      return true;
    });

    if (lastDocId) {
      const idx = filtered.findIndex(d => String(d.id) === String(lastDocId));
      if (idx !== -1) {
        filtered = filtered.slice(idx + 1);
      }
    }

    if (limit && limit > 0) {
      filtered = filtered.slice(0, Number(limit));
    }

    return filtered;
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

    const all = await this.getAllActive();
    return all.filter(d => {
      if (subId && subId !== 'all' && subId !== 'ALL') {
        const numSubId = Number(subId);
        const matchStr = String(d.substation_id) === subId;
        const matchNum = !isNaN(numSubId) && Number(d.substation_id) === numSubId;
        if (!matchStr && !matchNum) return false;
      }
      if (feedId && feedId !== 'all' && feedId !== 'ALL') {
        const numFeedId = Number(feedId);
        const matchStr = String(d.feeder_id) === feedId;
        const matchNum = !isNaN(numFeedId) && Number(d.feeder_id) === numFeedId;
        if (!matchStr && !matchNum) return false;
      }
      return true;
    }).length;
  },
  
  async getById(id: string) {
    const cacheKey = `device_doc_${id}`;
    return getOrFetchCached(cacheKey, TTL_DEVICES_LIST, async () => {
        const db = getTargetFirestore();
        const doc = await db.collection('devices').doc(id).get();
        logFirebaseRead('devices', `doc(${id})`, doc.exists ? 1 : 0);
        if (!doc.exists || doc.data()?.isDeleted) return null;
        const data = { id: doc.id, ...doc.data() };
        return data as any;
    }, 'devices');
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

        // Atomic stats increment
        await dashboardStatsRepo.recordDeviceCreated(docData, transaction);

        invalidateNamespace('devices');
        invalidateNamespace('dashboard_stats');
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
        if (currentData.version !== undefined && expectedVersion !== undefined && currentData.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
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
            version: (currentData.version || 0) + 1,
            updatedAt: now,
            lastOperationId: operationId
        };

        transaction.update(docRef, updateData);

        // Atomic stats update
        await dashboardStatsRepo.recordDeviceUpdated(currentData, updateData, transaction);

        invalidateNamespace('devices');
        invalidateNamespace('dashboard_stats');
        logFirebaseWrite('devices', id, 'UPDATE');
        return { id: doc.id, ...updateData };
    });
  },

  async delete(id: string, operationId: string, deletedBy: string) {
    const db = getTargetFirestore();
    return await db.runTransaction(async (transaction) => {
        const docRef = db.collection('devices').doc(id);
        const doc = await transaction.get(docRef);
        if (!doc.exists || doc.data()?.isDeleted) throw new Error('NOT_FOUND');
        
        const currentData = doc.data()!;
        if (currentData.lastOperationId === operationId) return currentData;

        const now = FieldValue.serverTimestamp();
        const updateData = {
            ...currentData,
            isDeleted: true,
            deletedBy,
            deletedAt: now,
            updatedAt: now,
            lastOperationId: operationId,
            version: (currentData.version || 0) + 1
        };

        const backupRef = db.collection('deleted_devices_backup').doc();
        transaction.set(backupRef, {
            ...currentData,
            originalId: doc.id,
            deletedBy,
            deletedAt: now,
            deleteBatchId: operationId
        });
        
        transaction.update(docRef, updateData);

        // Atomic stats decrement
        await dashboardStatsRepo.recordDeviceDeleted(currentData, transaction);
        
        invalidateNamespace('devices');
        invalidateNamespace('dashboard_stats');
        logFirebaseWrite('devices', id, 'DELETE');
        return { id: doc.id, ...updateData };
    });
  }
};
