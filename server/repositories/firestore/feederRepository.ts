import { getTargetFirestore } from '../../firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export type Feeder = {
  id: string;
  substation_id: string;
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

export const feederRepo = {
  async list() {
    const db = getTargetFirestore();
    const snapshot = await db.collection('feeders')
        .where('isDeleted', '==', false)
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Feeder[];
  },
  
  async getById(id: string) {
    const db = getTargetFirestore();
    const doc = await db.collection('feeders').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Feeder;
  },

  async findByCode(code: string) {
      const db = getTargetFirestore();
      const snapshot = await db.collection('feeders')
          .where('feeder_code', '==', code)
          .where('isDeleted', '==', false)
          .get();
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
        return { id: doc.id, ...updateData };
    });
  }
};
