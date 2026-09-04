import { getTargetFirestore } from '../../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  getOrFetchCached,
  setCached,
  invalidateNamespace,
  logFirebaseRead,
  logFirebaseWrite,
  TTL_MASTER_DATA
} from '../../utils/firestoreCache';

export interface BundledSubstation {
  id: string;
  code: string;
  substation_code: string;
  name: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  version?: number;
  isDeleted?: boolean;
}

export interface BundledFeeder {
  id: string;
  code: string;
  feeder_code: string;
  name: string;
  substation_id: string;
  substation_name?: string;
  status: string;
  voltage_level?: string;
  start_point?: string;
  end_point?: string;
  version?: number;
  isDeleted?: boolean;
}

export interface GridStructureDocument {
  substations: BundledSubstation[];
  feeders: BundledFeeder[];
  updated_at?: any;
}

const CACHE_KEY_GRID_STRUCTURE = 'grid_structure_bundled';

export const gridStructureRepo = {
  /**
   * Retrieves bundled grid structure from in-memory cache,
   * or reads metadata/grid_structure (1 Firestore read).
   * If document does not exist, automatically bootstraps from source collections.
   */
  async getGridStructure(): Promise<GridStructureDocument> {
    return getOrFetchCached(
      CACHE_KEY_GRID_STRUCTURE,
      TTL_MASTER_DATA,
      async () => {
        const db = getTargetFirestore();
        const docRef = db.collection('metadata').doc('grid_structure');
        const docSnap = await docRef.get();
        logFirebaseRead('metadata', 'doc(grid_structure)', docSnap.exists ? 1 : 0);

        if (docSnap.exists) {
          const data = docSnap.data() as any;
          if (data && Array.isArray(data.substations) && Array.isArray(data.feeders)) {
            return {
              substations: data.substations,
              feeders: data.feeders,
              updated_at: data.updated_at
            };
          }
        }

        // Bundle document missing or empty: automatically bootstrap
        return await this.rebuildGridStructure();
      },
      'grid_structure'
    );
  },

  /**
   * Rebuilds metadata/grid_structure from substations and feeders collections,
   * updates Firestore metadata/grid_structure document, and refreshes in-memory cache.
   */
  async rebuildGridStructure(): Promise<GridStructureDocument> {
    const db = getTargetFirestore();
    const [subSnap, feederSnap] = await Promise.all([
      db.collection('substations').get(),
      db.collection('feeders').get()
    ]);

    const activeSubDocs = subSnap.docs.filter(doc => {
      const d = doc.data();
      return d.isDeleted !== true && !d.deleted_at && !d.deletedAt;
    });

    const activeFeederDocs = feederSnap.docs.filter(doc => {
      const d = doc.data();
      return d.isDeleted !== true && !d.deleted_at && !d.deletedAt;
    });

    logFirebaseRead('substations', 'bootstrap(active)', activeSubDocs.length);
    logFirebaseRead('feeders', 'bootstrap(active)', activeFeederDocs.length);

    const substations: BundledSubstation[] = activeSubDocs.map(doc => {
      const d = doc.data();
      const code = String(d.substation_code || d.code || doc.id);
      return {
        id: doc.id,
        code,
        substation_code: code,
        name: d.name || code,
        address: d.address || '',
        latitude: typeof d.latitude === 'number' ? d.latitude : (d.latitude ? Number(d.latitude) : null),
        longitude: typeof d.longitude === 'number' ? d.longitude : (d.longitude ? Number(d.longitude) : null),
        status: d.status || 'ACTIVE',
        version: d.version || 1,
        isDeleted: false
      };
    });

    const subNameMap = new Map(substations.map(s => [s.id, s.name]));

    const feeders: BundledFeeder[] = activeFeederDocs.map(doc => {
      const d = doc.data();
      const code = String(d.feeder_code || d.code || doc.id);
      const subId = String(d.substation_id ?? '');
      return {
        id: doc.id,
        code,
        feeder_code: code,
        name: d.name || code,
        substation_id: subId,
        substation_name: subNameMap.get(subId) || '',
        status: d.status || 'ACTIVE',
        voltage_level: d.voltage_level || '22kV',
        start_point: d.start_point || '',
        end_point: d.end_point || '',
        version: d.version || 1,
        isDeleted: false
      };
    });

    const bundle: GridStructureDocument = {
      substations,
      feeders,
      updated_at: FieldValue.serverTimestamp()
    };

    try {
      await db.collection('metadata').doc('grid_structure').set(bundle);
      logFirebaseWrite('metadata', 'grid_structure', 'UPDATE_BUNDLE');
    } catch (err) {
      console.error('[GRID_STRUCTURE] Error persisting metadata/grid_structure bundle:', err);
    }

    // Invalidate and set cache
    invalidateNamespace('grid_structure');
    invalidateNamespace('substations');
    invalidateNamespace('feeders');
    invalidateNamespace('dashboard_stats');

    setCached(CACHE_KEY_GRID_STRUCTURE, bundle, TTL_MASTER_DATA, 'grid_structure');

    return bundle;
  },

  /**
   * Get substations with filtering and pagination from bundled data.
   */
  async getSubstations(options?: { status?: string; limit?: number; lastDocId?: string }): Promise<BundledSubstation[]> {
    const grid = await this.getGridStructure();
    let list = grid.substations;

    if (options?.status) {
      list = list.filter(s => s.status === options.status);
    }

    if (options?.lastDocId) {
      const idx = list.findIndex(s => s.id === options.lastDocId);
      if (idx !== -1) {
        list = list.slice(idx + 1);
      }
    }

    if (options?.limit && options.limit > 0) {
      list = list.slice(0, options.limit);
    }

    return list;
  },

  /**
   * Get feeders with filtering and pagination from bundled data.
   */
  async getFeeders(options?: { substation_id?: string | number; status?: string; limit?: number; lastDocId?: string }): Promise<BundledFeeder[]> {
    const grid = await this.getGridStructure();
    let list = grid.feeders;

    if (options?.substation_id !== undefined && options.substation_id !== null && options.substation_id !== '' && options.substation_id !== 'all' && options.substation_id !== 'ALL') {
      const subIdStr = String(options.substation_id).trim();
      list = list.filter(f => String(f.substation_id || '').trim() === subIdStr);
    }

    if (options?.status) {
      list = list.filter(f => f.status === options.status);
    }

    if (options?.lastDocId) {
      const idx = list.findIndex(f => f.id === options.lastDocId);
      if (idx !== -1) {
        list = list.slice(idx + 1);
      }
    }

    if (options?.limit && options.limit > 0) {
      list = list.slice(0, options.limit);
    }

    return list;
  },

  /**
   * Find substation by ID from bundle or fallback to single doc fetch.
   */
  async getSubstationById(id: string): Promise<BundledSubstation | null> {
    const grid = await this.getGridStructure();
    const found = grid.substations.find(s => String(s.id) === String(id));
    if (found) return found;

    // Fallback in case newly created and not yet synced
    const db = getTargetFirestore();
    const doc = await db.collection('substations').doc(id).get();
    logFirebaseRead('substations', `doc(${id})`, doc.exists ? 1 : 0);
    if (!doc.exists || doc.data()?.isDeleted) return null;
    const d = doc.data()!;
    const code = String(d.substation_code || d.code || doc.id);
    return {
      id: doc.id,
      code,
      substation_code: code,
      name: d.name || code,
      address: d.address || '',
      latitude: d.latitude || null,
      longitude: d.longitude || null,
      status: d.status || 'ACTIVE',
      version: d.version || 1,
      isDeleted: false
    };
  },

  /**
   * Find feeder by ID from bundle or fallback to single doc fetch.
   */
  async getFeederById(id: string): Promise<BundledFeeder | null> {
    const grid = await this.getGridStructure();
    const found = grid.feeders.find(f => String(f.id) === String(id));
    if (found) return found;

    const db = getTargetFirestore();
    const doc = await db.collection('feeders').doc(id).get();
    logFirebaseRead('feeders', `doc(${id})`, doc.exists ? 1 : 0);
    if (!doc.exists || doc.data()?.isDeleted) return null;
    const d = doc.data()!;
    const code = String(d.feeder_code || d.code || doc.id);
    return {
      id: doc.id,
      code,
      feeder_code: code,
      name: d.name || code,
      substation_id: String(d.substation_id || ''),
      status: d.status || 'ACTIVE',
      voltage_level: d.voltage_level || '22kV',
      start_point: d.start_point || '',
      end_point: d.end_point || '',
      version: d.version || 1,
      isDeleted: false
    };
  },

  /**
   * Find substation by code.
   */
  async findSubstationByCode(code: string): Promise<BundledSubstation | null> {
    const grid = await this.getGridStructure();
    const normalized = code.trim().toLowerCase();
    const found = grid.substations.find(s =>
      (s.substation_code && s.substation_code.trim().toLowerCase() === normalized) ||
      (s.code && s.code.trim().toLowerCase() === normalized)
    );
    if (found) return found;
    return null;
  },

  /**
   * Find feeder by code.
   */
  async findFeederByCode(code: string): Promise<BundledFeeder | null> {
    const grid = await this.getGridStructure();
    const normalized = code.trim().toLowerCase();
    const found = grid.feeders.find(f =>
      (f.feeder_code && f.feeder_code.trim().toLowerCase() === normalized) ||
      (f.code && f.code.trim().toLowerCase() === normalized)
    );
    if (found) return found;
    return null;
  },

  /**
   * Fast counts without Firestore queries.
   */
  async countSubstations(): Promise<number> {
    const grid = await this.getGridStructure();
    return grid.substations.length;
  },

  async countFeeders(options?: { substation_id?: string | number }): Promise<number> {
    const grid = await this.getGridStructure();
    if (options?.substation_id !== undefined && options.substation_id !== null && options.substation_id !== '' && options.substation_id !== 'all' && options.substation_id !== 'ALL') {
      const subIdStr = String(options.substation_id).trim();
      return grid.feeders.filter(f => String(f.substation_id || '').trim() === subIdStr).length;
    }
    return grid.feeders.length;
  }
};
