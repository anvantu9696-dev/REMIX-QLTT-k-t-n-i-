import { getTargetFirestore } from '../../firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

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

export const loopRepo = {
  async list() {
    const db = getTargetFirestore();
    const snapshot = await db.collection('loops')
        .where('isDeleted', '==', false)
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Loop[];
  },
  
  async getById(id: string) {
    const db = getTargetFirestore();
    const doc = await db.collection('loops').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Loop;
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
    return { id: docRef.id, ...data };
  },

  async update(id: string, data: Partial<Loop>) {
    const db = getTargetFirestore();
    const docRef = db.collection('loops').doc(id);
    await docRef.update({
        ...data,
        updatedAt: FieldValue.serverTimestamp()
    });
  },

  async delete(id: string, updatedBy: string) {
    const db = getTargetFirestore();
    const docRef = db.collection('loops').doc(id);
    await docRef.update({
        isDeleted: true,
        updatedBy,
        updatedAt: FieldValue.serverTimestamp()
    });
  }
};
