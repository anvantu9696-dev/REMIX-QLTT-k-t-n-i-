import { getTargetFirestore } from '../../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const topologyVersionRepo = {
  async getVersionsByLoopId(loopId: string) {
    const db = getTargetFirestore();
    const snapshot = await db.collection('topology_versions')
        .where('loop_id', '==', loopId)
        .orderBy('createdAt', 'desc')
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getActiveVersion(loopId: string) {
    const db = getTargetFirestore();
    const snapshot = await db.collection('topology_versions')
        .where('loop_id', '==', loopId)
        .where('status', 'in', ['PUBLISHED', 'APPROVED'])
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  },

  async create(data: any) {
    const db = getTargetFirestore();
    const docRef = db.collection('topology_versions').doc();
    const now = FieldValue.serverTimestamp();
    const payload = {
        ...data,
        createdAt: now,
        updatedAt: now
    };
    await docRef.set(payload);
    return { id: docRef.id, ...payload };
  }
};
