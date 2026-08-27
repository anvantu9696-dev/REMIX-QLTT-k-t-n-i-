import { getTargetFirestore } from '../../firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export type Device = {
  id: string;
  device_id: string;
  substation_id: number;
  feeder_id: number;
  device_code: string;
  name: string;
  status: string; // ACTIVE, INACTIVE, MAINTENANCE
  version: number;
  createdAt: any;
  updatedAt: any;
  isDeleted: boolean;
  lastOperationId?: string;
  createdBy: string;
  updatedBy: string;
  
  // New fields
  device_type: string; // LBS, REC, DS, RMU, OTHER
  unit?: string;
  team?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  pole_number?: string;
  
  // Operational fields
  switch_status?: string; // CLOSED, OPEN, UNKNOWN
  scada_status?: string; // SIGNAL, NO_SIGNAL, UNKNOWN
  relay_79?: string; // ON, OFF, N_A
  battery_status?: string; // GOOD, WEAK, BROKEN, REPLACING, UNCHECKED
  settings?: string; // Chỉnh định
};

export type DeviceCreateInput = Omit<Device, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'lastOperationId'>;

export const deviceRepo = {
  async list() {
    const db = getTargetFirestore();
    const snapshot = await db.collection('devices')
        .where('isDeleted', '==', false)
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Device[];
  },
  
  async getById(id: string) {
    const db = getTargetFirestore();
    const doc = await db.collection('devices').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Device;
  },

  async getByDeviceId(deviceId: string) {
    const db = getTargetFirestore();
    const snapshot = await db.collection('devices')
        .where('device_id', '==', deviceId)
        .where('isDeleted', '==', false)
        .get();
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
        return { id: doc.id, ...updateData };
    });
  },

  async delete(id: string, operationId: string) {
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
            deletedAt: now,
            updatedAt: now,
            version: currentData.version + 1,
            lastOperationId: operationId
        };
        transaction.update(docRef, updateData);
        return { id: doc.id, ...updateData };
    });
  }
};
