import { getTargetFirestore } from '../../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { invalidateNamespace, logFirebaseWrite, TTL_MASTER_DATA } from '../../utils/firestoreCache';
import { gridStructureRepo, BundledSubstation } from './gridStructureRepository';
import { dashboardStatsRepo } from './dashboardStatsRepository';

export type Substation = {
  id: string;
  substation_code: string;
  code?: string;
  name: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  version: number;
  createdAt?: any;
  updatedAt?: any;
  isDeleted: boolean;
  lastOperationId?: string;
};

export type SubstationCreateInput = Omit<Substation, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'lastOperationId'>;

export const substationRepo = {
  async list(options?: { status?: string; limit?: number; lastDocId?: string }): Promise<Substation[]> {
    const subs = await gridStructureRepo.getSubstations(options);
    return subs.map(s => ({
      ...s,
      version: s.version || 1,
      isDeleted: false
    })) as Substation[];
  },

  async count(): Promise<number> {
    return gridStructureRepo.countSubstations();
  },
  
  async getById(id: string): Promise<Substation | null> {
    const sub = await gridStructureRepo.getSubstationById(id);
    if (!sub) return null;
    return {
      ...sub,
      version: sub.version || 1,
      isDeleted: false
    } as Substation;
  },

  async findByCode(code: string): Promise<Substation | null> {
    const sub = await gridStructureRepo.findSubstationByCode(code);
    if (!sub) return null;
    return {
      ...sub,
      version: sub.version || 1,
      isDeleted: false
    } as Substation;
  },

  async exists(id: string): Promise<boolean> {
    const doc = await this.getById(id);
    return doc !== null && !doc.isDeleted;
  },

  async create(data: SubstationCreateInput, operationId: string): Promise<Substation> {
    const db = getTargetFirestore();
    const result = await db.runTransaction(async (transaction) => {
        const eventRef = db.collection('operation_events').doc(operationId);
        const eventDoc = await transaction.get(eventRef);
        if (eventDoc.exists) return eventDoc.data()?.result;

        const docRef = db.collection('substations').doc();
        const now = FieldValue.serverTimestamp();
        
        const code = (data as any).substation_code || (data as any).code || docRef.id;
        const docData = {
            ...data,
            substation_code: code,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            lastOperationId: operationId
        };

        transaction.set(docRef, docData);
        transaction.set(eventRef, { operationId, result: { id: docRef.id, ...docData } });
        
        await dashboardStatsRepo.recordSubstationDelta(1, transaction);

        logFirebaseWrite('substations', docRef.id, 'CREATE');
        return { id: docRef.id, ...docData } as Substation;
    });

    // Rebuild bundled document and invalidate cache
    await gridStructureRepo.rebuildGridStructure();
    return result;
  },

  async update(id: string, data: Partial<Substation>, expectedVersion: number, operationId: string) {
    const db = getTargetFirestore();
    const result = await db.runTransaction(async (transaction) => {
        const docRef = db.collection('substations').doc(id);
        const doc = await transaction.get(docRef);
        if (!doc.exists || doc.data()?.isDeleted) throw new Error('NOT_FOUND');
        
        const currentData = doc.data()!;
        if (currentData.version !== undefined && expectedVersion !== undefined && currentData.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
        if (currentData.lastOperationId === operationId) return currentData;

        const now = FieldValue.serverTimestamp();
        const updateData = {
            ...currentData,
            ...data,
            version: (currentData.version || 0) + 1,
            updatedAt: now,
            lastOperationId: operationId
        };

        transaction.update(docRef, updateData);
        
        logFirebaseWrite('substations', id, 'UPDATE');
        return { id: doc.id, ...updateData };
    });

    // Rebuild bundled document and invalidate cache
    await gridStructureRepo.rebuildGridStructure();
    return result;
  },

  async delete(id: string, operationId: string) {
    const db = getTargetFirestore();
    const result = await db.runTransaction(async (transaction) => {
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
            version: (currentData.version || 0) + 1,
            lastOperationId: operationId
        };

        transaction.update(docRef, updateData);
        
        await dashboardStatsRepo.recordSubstationDelta(-1, transaction);

        logFirebaseWrite('substations', id, 'DELETE');
        return { id: doc.id, ...updateData };
    });

    // Rebuild bundled document and invalidate cache
    await gridStructureRepo.rebuildGridStructure();
    return result;
  }
};
