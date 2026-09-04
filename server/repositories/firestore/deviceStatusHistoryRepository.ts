import { getTargetFirestore } from '../../firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { logFirebaseRead, logFirebaseWrite } from '../../utils/firestoreCache.js';

export const deviceStatusHistoryRepo = {
  async getByDeviceId(deviceId: string, limit = 20) {
    const db = getTargetFirestore();
    const parsedLimit = Math.min(Math.max(1, limit), 50);
    const snapshot = await db.collection('device_status_history')
      .where('device_id', '==', deviceId)
      .orderBy('changedAt', 'desc')
      .limit(parsedLimit)
      .get();
      
    logFirebaseRead('device_status_history', `device_id=${deviceId},limit=${parsedLimit}`, snapshot.size);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        created_at: data.changedAt ? (data.changedAt.toDate ? data.changedAt.toDate().toISOString() : data.changedAt) : (data.created_at || new Date().toISOString())
      };
    });
  },

  async add(data: {
    device_id: string;
    previousStatus: string;
    newStatus: string;
    changedFields: any;
    changedBy: string;
    operationId: string;
    deviceVersion: number;
    note?: string;
  }) {
    const db = getTargetFirestore();
    const now = FieldValue.serverTimestamp();
    const docRef = await db.collection('device_status_history').add({
      ...data,
      changedAt: now
    });
    logFirebaseWrite('device_status_history', docRef.id, 'CREATE');
  }
};
