import { getTargetFirestore } from '../../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getOrFetchCached, invalidateNamespace, logFirebaseWrite, TTL_MASTER_DATA } from '../../utils/firestoreCache';
import { gridStructureRepo, BundledFeeder } from './gridStructureRepository';
import { dashboardStatsRepo } from './dashboardStatsRepository';

export type Feeder = {
  id: string;
  substation_id: string | number;
  feeder_code: string;
  code?: string;
  name: string;
  status: string;
  version: number;
  createdAt?: any;
  updatedAt?: any;
  isDeleted: boolean;
  lastOperationId?: string;
  createdBy?: string;
  updatedBy?: string;
  voltage_level?: string;
  start_point?: string;
  end_point?: string;
};

export type FeederCreateInput = Omit<Feeder, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'lastOperationId'>;

export const feederRepo = {
  async list(options?: { substation_id?: string | number; status?: string; limit?: number; lastDocId?: string }): Promise<Feeder[]> {
    const rawSubId = options?.substation_id;
    const isAll = rawSubId === undefined || rawSubId === null || rawSubId === '' || rawSubId === 'all' || rawSubId === 'ALL';

    // Normalize cache key: if substationId is empty or 'all' without other filters, always use 'feeders_list_all'
    const cacheKey = (isAll && !options?.status && !options?.limit && !options?.lastDocId)
      ? 'feeders_list_all'
      : `feeders_list_${isAll ? 'all' : String(rawSubId)}_${options?.status || 'any'}_${options?.limit || 'nolimit'}_${options?.lastDocId || 'none'}`;

    return getOrFetchCached(
      cacheKey,
      TTL_MASTER_DATA, // 2 hours
      async () => {
        const queryOptions = isAll
          ? { ...options, substation_id: undefined }
          : { ...options, substation_id: rawSubId };
        const feeders = await gridStructureRepo.getFeeders(queryOptions);
        return feeders.map(f => ({
          ...f,
          substation_id: f.substation_id,
          version: f.version || 1,
          isDeleted: false
        })) as Feeder[];
      },
      'feeders'
    );
  },

  async listBySubstationId(substationId: string | number): Promise<Feeder[]> {
    return this.list({ substation_id: substationId });
  },

  async count(options?: { substation_id?: string | number }): Promise<number> {
    return gridStructureRepo.countFeeders(options);
  },
  
  async getById(id: string): Promise<Feeder | null> {
    const feeder = await gridStructureRepo.getFeederById(id);
    if (!feeder) return null;
    return {
      ...feeder,
      substation_id: feeder.substation_id,
      version: feeder.version || 1,
      isDeleted: false
    } as Feeder;
  },

  async findByCode(code: string): Promise<Feeder | null> {
    const feeder = await gridStructureRepo.findFeederByCode(code);
    if (!feeder) return null;
    return {
      ...feeder,
      substation_id: feeder.substation_id,
      version: feeder.version || 1,
      isDeleted: false
    } as Feeder;
  },

  async exists(id: string): Promise<boolean> {
    const doc = await this.getById(id);
    return doc !== null && !doc.isDeleted;
  },

  async create(data: FeederCreateInput, operationId: string): Promise<Feeder> {
    const db = getTargetFirestore();
    const result = await db.runTransaction(async (transaction) => {
        const eventRef = db.collection('operation_events').doc(operationId);
        const eventDoc = await transaction.get(eventRef);
        if (eventDoc.exists) return eventDoc.data()?.result;

        const docRef = db.collection('feeders').doc();
        const now = FieldValue.serverTimestamp();
        
        const code = (data as any).feeder_code || (data as any).code || docRef.id;
        const docData = {
            ...data,
            feeder_code: code,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            lastOperationId: operationId
        };

        transaction.set(docRef, docData);
        transaction.set(eventRef, { operationId, result: { id: docRef.id, ...docData } });
        
        await dashboardStatsRepo.recordFeederDelta(1, transaction);

        logFirebaseWrite('feeders', docRef.id, 'CREATE');
        return { id: docRef.id, ...docData } as Feeder;
    });

    // Rebuild bundled document and invalidate cache
    await gridStructureRepo.rebuildGridStructure();
    return result;
  },

  async update(id: string, data: Partial<Feeder>, expectedVersion: number, operationId: string) {
    const db = getTargetFirestore();
    const result = await db.runTransaction(async (transaction) => {
        const docRef = db.collection('feeders').doc(id);
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
        
        logFirebaseWrite('feeders', id, 'UPDATE');
        return { id: doc.id, ...updateData };
    });

    // Rebuild bundled document and invalidate cache
    await gridStructureRepo.rebuildGridStructure();
    return result;
  },

  async delete(id: string, operationId: string) {
    const db = getTargetFirestore();
    const result = await db.runTransaction(async (transaction) => {
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
            version: (currentData.version || 0) + 1,
            lastOperationId: operationId
        };

        transaction.update(docRef, updateData);
        
        await dashboardStatsRepo.recordFeederDelta(-1, transaction);

        logFirebaseWrite('feeders', id, 'DELETE');
        return { id: doc.id, ...updateData };
    });

    // Rebuild bundled document and invalidate cache
    await gridStructureRepo.rebuildGridStructure();
    return result;
  }
};
